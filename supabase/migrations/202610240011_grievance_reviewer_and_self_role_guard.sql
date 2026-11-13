begin;

-- Account administrators cannot edit their own profile row, even through direct Supabase API calls.
drop policy if exists profiles_admin_update_accounts on public.profiles;
create policy profiles_admin_update_accounts
on public.profiles for update to authenticated
using (
  id <> (select auth.uid())
  and (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'admin'
  and (select app_private.staff_mfa_verified())
  and role in ('staff', 'ngo')
)
with check (
  id <> (select auth.uid())
  and (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'admin'
  and (select app_private.staff_mfa_verified())
  and ((role = 'staff' and sub_role in ('verification_team', 'caseworker', 'protection_officer', 'grievance_committee', 'admin'))
    or (role = 'ngo' and sub_role is null and ngo_id is not null
      and exists (select 1 from public.ngos n where n.id = ngo_id and n.verification_status = 'verified')))
);

alter table public.staff_grievances
  add column assigned_reviewer_id uuid references public.profiles(id) on delete restrict;
create index staff_grievances_reviewer_queue_idx
  on public.staff_grievances(assigned_reviewer_id, created_at, id);

drop policy if exists grievances_committee_read on public.staff_grievances;
create policy grievances_committee_read
on public.staff_grievances for select to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'grievance_committee'
  and (select app_private.staff_mfa_verified())
  and assigned_reviewer_id = (select auth.uid())
);

drop policy if exists grievances_committee_update_status on public.staff_grievances;
create policy grievances_committee_update_status
on public.staff_grievances for update to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'grievance_committee'
  and (select app_private.staff_mfa_verified())
  and assigned_reviewer_id = (select auth.uid())
)
with check (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'grievance_committee'
  and (select app_private.staff_mfa_verified())
  and assigned_reviewer_id = (select auth.uid())
);

create or replace function public.claim_next_staff_grievance()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  actor uuid := (select auth.uid());
  selected_grievance uuid;
begin
  if actor is null
    or app_private.current_role() <> 'staff'
    or app_private.current_sub_role() <> 'grievance_committee'
    or not app_private.staff_mfa_verified() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  select g.id into selected_grievance
  from public.staff_grievances g
  where g.assigned_reviewer_id is null
    and g.status in ('open', 'reviewing')
  order by g.created_at, g.id
  limit 1
  for update skip locked;

  if selected_grievance is null then return null; end if;

  update public.staff_grievances
  set assigned_reviewer_id = actor
  where id = selected_grievance and assigned_reviewer_id is null;

  if not found then return null; end if;
  return selected_grievance;
end;
$$;
revoke all on function public.claim_next_staff_grievance() from public, anon;
grant execute on function public.claim_next_staff_grievance() to authenticated;

-- View audit records identify the authorised reviewer and record, never an anonymous submitter.
create or replace function public.log_audit_event(p_entity_table text, p_entity_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  actor uuid := (select auth.uid());
  allowed boolean := false;
begin
  if actor is null or p_action not in ('view', 'document_download', 'complaint_list') then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  if p_entity_table = 'staff_grievances' then
    allowed := p_action = 'view'
      and app_private.current_role() = 'staff'
      and app_private.current_sub_role() = 'grievance_committee'
      and app_private.staff_mfa_verified()
      and exists (select 1 from public.staff_grievances g where g.id = p_entity_id and g.assigned_reviewer_id = actor);
  elsif p_entity_table = 'complaint_list' and p_entity_id is null and p_action = 'complaint_list' then
    allowed := app_private.current_role() in ('child', 'adult_after_care')
      or (app_private.current_role() = 'staff' and app_private.current_sub_role() = 'protection_officer' and app_private.staff_mfa_verified());
  elsif p_entity_table = 'complaints' then
    allowed := exists (
      select 1 from public.complaints c where c.id = p_entity_id
        and ((c.reporter_user_id = actor and app_private.current_role() in ('child', 'adult_after_care'))
          or (app_private.current_role() = 'staff' and app_private.current_sub_role() = 'protection_officer' and app_private.staff_mfa_verified() and app_private.is_assigned_to_complaint(c.id)))
    );
  elsif p_entity_table = 'children' then
    allowed := app_private.can_access_child(p_entity_id);
  elsif p_entity_table = 'child_private' then
    allowed := exists (select 1 from public.child_private cp where cp.child_id = p_entity_id and app_private.can_access_child(cp.child_id));
  elsif p_entity_table = 'documents' then
    allowed := exists (
      select 1 from public.documents d where d.id = p_entity_id
        and (d.owner_user_id = actor or (d.child_id is not null and app_private.can_access_child(d.child_id))
          or (d.ngo_id is not null and app_private.current_role() = 'ngo' and d.ngo_id = app_private.current_ngo_id()))
    );
  elsif p_entity_table = 'parent_documents' then
    allowed := exists (
      select 1 from public.parent_documents d join public.parent_applications a on a.id = d.application_id
      where d.id = p_entity_id and (a.user_id = actor or (app_private.current_role() = 'staff' and app_private.current_sub_role() in ('verification_team', 'caseworker') and app_private.staff_mfa_verified() and app_private.is_assigned_to_parent(a.id)))
    );
  elsif p_entity_table = 'adoption_tracker' then
    allowed := exists (
      select 1 from public.adoption_tracker t join public.parent_applications a on a.id = t.application_id
      where t.id = p_entity_id and (a.user_id = actor or (app_private.current_role() = 'staff' and app_private.current_sub_role() in ('verification_team', 'caseworker') and app_private.staff_mfa_verified() and app_private.is_assigned_to_parent(a.id)))
    );
  elsif p_entity_table = 'parent_applications' then
    allowed := exists (
      select 1 from public.parent_applications a
      where a.id = p_entity_id and (a.user_id = actor or (app_private.current_role() = 'staff' and app_private.current_sub_role() in ('verification_team', 'caseworker') and app_private.staff_mfa_verified() and app_private.is_assigned_to_parent(a.id)))
    );
  elsif p_entity_table = 'support_requests' then
    allowed := exists (
      select 1 from public.support_requests r
      where r.id = p_entity_id and (r.requester_user_id = actor or (app_private.current_role() = 'staff' and app_private.current_sub_role() in ('caseworker', 'verification_team') and app_private.staff_mfa_verified() and app_private.is_assigned_to_child(r.child_id)))
    );
  elsif p_entity_table = 'foster_interests' then
    allowed := app_private.current_role() = 'staff' and app_private.current_sub_role() = 'caseworker'
      and app_private.staff_mfa_verified()
      and exists (select 1 from public.foster_interests f where f.id = p_entity_id and f.assigned_caseworker_id = actor);
  elsif p_entity_table = 'data_rights_requests' then
    allowed := exists (
      select 1 from public.data_rights_requests r
      where r.id = p_entity_id and (r.user_id = actor or (app_private.current_role() = 'staff' and app_private.current_sub_role() in ('verification_team', 'caseworker') and app_private.staff_mfa_verified() and exists (select 1 from public.children c where c.user_id = r.user_id and app_private.is_assigned_to_child(c.id))))
    );
  end if;

  if not allowed then raise exception 'Not authorized.' using errcode = '42501'; end if;
  insert into public.audit_log(actor_id, entity_table, entity_id, action)
  values (actor, p_entity_table, p_entity_id, p_action);
end;
$$;
revoke all on function public.log_audit_event(text, uuid, text) from public, anon;
grant execute on function public.log_audit_event(text, uuid, text) to authenticated;

commit;
