begin;

alter table public.foster_interests
  add column assigned_caseworker_id uuid references public.profiles(id) on delete restrict;
create index foster_interests_assigned_caseworker_idx
  on public.foster_interests(assigned_caseworker_id, created_at desc)
  where assigned_caseworker_id is not null;

create or replace function public.claim_next_foster_interest()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $$
declare
  selected_id uuid;
begin
  if (select app_private.current_role()) <> 'staff'
    or (select app_private.current_sub_role()) <> 'caseworker'
    or not (select app_private.staff_mfa_verified()) then
    return null;
  end if;

  select f.id into selected_id
  from public.foster_interests f
  where f.assigned_caseworker_id is null and f.status = 'pending'
  order by f.created_at
  for update skip locked
  limit 1;

  if selected_id is null then return null; end if;
  update public.foster_interests
    set assigned_caseworker_id = (select auth.uid())
    where id = selected_id;
  insert into public.audit_log(actor_id, entity_table, entity_id, action)
    values ((select auth.uid()), 'foster_interests', selected_id, 'update');
  return selected_id;
end;
$$;
revoke all on function public.claim_next_foster_interest() from public, anon;
grant execute on function public.claim_next_foster_interest() to authenticated;

drop policy if exists foster_interest_assigned_caseworker_read on public.foster_interests;
create policy foster_interest_assigned_caseworker_read
on public.foster_interests for select to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'caseworker'
  and (select app_private.staff_mfa_verified())
  and assigned_caseworker_id = (select auth.uid())
);
drop policy if exists foster_interest_assigned_caseworker_update on public.foster_interests;
create policy foster_interest_assigned_caseworker_update
on public.foster_interests for update to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'caseworker'
  and (select app_private.staff_mfa_verified())
  and assigned_caseworker_id = (select auth.uid())
)
with check (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'caseworker'
  and (select app_private.staff_mfa_verified())
  and assigned_caseworker_id = (select auth.uid())
);

-- Self-service inserts cannot attest to a staff verification decision or select an archive-only document type.
drop policy if exists documents_child_upload on public.documents;
create policy documents_child_upload
on public.documents for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and owner_user_id is null
  and ngo_id is null
  and child_id is not null
  and document_type = 'education'
  and verified_by is null
  and storage_path like ('child/' || child_id::text || '/%')
  and exists (select 1 from public.children c where c.id = child_id and c.user_id = (select auth.uid()))
);
drop policy if exists documents_ngo_upload on public.documents;
create policy documents_ngo_upload
on public.documents for insert to authenticated
with check (
  (select app_private.current_role()) = 'ngo'
  and uploaded_by = (select auth.uid())
  and ngo_id = (select app_private.current_ngo_id())
  and owner_user_id is null
  and child_id is null
  and document_type in ('recognition', 'compliance', 'funding_support')
  and verified_by is null
  and storage_path like ('ngo/' || (select app_private.current_ngo_id())::text || '/%')
);
drop policy if exists documents_assigned_staff_upload on public.documents;
create policy documents_assigned_staff_upload
on public.documents for insert to authenticated
with check (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('caseworker', 'verification_team')
  and (select app_private.staff_mfa_verified())
  and uploaded_by = (select auth.uid())
  and owner_user_id is null
  and ngo_id is null
  and child_id is not null
  and document_type in ('education', 'care_record')
  and verified_by is null
  and storage_path like ('child/' || child_id::text || '/%')
  and (select app_private.is_assigned_to_child(child_id))
);

drop policy if exists parent_documents_owner_insert on public.parent_documents;
create policy parent_documents_owner_insert
on public.parent_documents for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and (select app_private.current_role()) = 'parent'
  and exists (select 1 from public.parent_applications a where a.id = application_id and a.user_id = (select auth.uid()))
  and document_type in ('identity', 'address', 'income', 'medical', 'police_verification')
  and storage_path like ('parent/' || (select auth.uid())::text || '/%')
  and verification_status = 'submitted'
  and verified_by is null
  and verified_at is null
);

drop policy if exists consents_assigned_staff_read_subject on public.consents;
create policy consents_assigned_staff_read_subject
on public.consents for select to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('caseworker', 'verification_team')
  and (select app_private.staff_mfa_verified())
  and (
    (user_id is not null and exists (
      select 1 from public.children c
      where c.user_id = consents.user_id and (select app_private.is_assigned_to_child(c.id))
    ))
    or (user_id is not null and exists (
      select 1 from public.parent_applications a
      where a.user_id = consents.user_id and (select app_private.is_assigned_to_parent(a.id))
    ))
    or (foster_interest_id is not null and exists (
      select 1 from public.foster_interests f
      where f.id = consents.foster_interest_id and f.assigned_caseworker_id = (select auth.uid())
    ))
  )
);

-- Adult-after-care data requests can be read or handled only by the caseworker assigned to that adult's care record.
drop policy if exists data_rights_owner_insert on public.data_rights_requests;
create policy data_rights_owner_insert
on public.data_rights_requests for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select app_private.current_role()) = 'adult_after_care'
  and status = 'submitted'
  and reviewed_by is null
  and reviewed_at is null
);
drop policy if exists data_rights_staff_read on public.data_rights_requests;
create policy data_rights_staff_read
on public.data_rights_requests for select to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('verification_team', 'caseworker')
  and (select app_private.staff_mfa_verified())
  and exists (
    select 1 from public.children c
    where c.user_id = data_rights_requests.user_id and (select app_private.is_assigned_to_child(c.id))
  )
);
drop policy if exists data_rights_staff_update on public.data_rights_requests;
create policy data_rights_staff_update
on public.data_rights_requests for update to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('verification_team', 'caseworker')
  and (select app_private.staff_mfa_verified())
  and exists (
    select 1 from public.children c
    where c.user_id = data_rights_requests.user_id and (select app_private.is_assigned_to_child(c.id))
  )
)
with check (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('verification_team', 'caseworker')
  and (select app_private.staff_mfa_verified())
  and reviewed_by = (select auth.uid())
  and exists (
    select 1 from public.children c
    where c.user_id = data_rights_requests.user_id and (select app_private.is_assigned_to_child(c.id))
  )
);
grant update (status, reviewed_by, reviewed_at) on table public.data_rights_requests to authenticated;

-- Assignment records are valid only for the matching staff sub-role; admin roster edits cannot expose cases to unrelated roles.
create or replace function public.enforce_assignment_staff_role()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_role text;
  target_sub_role text;
begin
  select p.role, p.sub_role into target_role, target_sub_role
  from public.profiles p where p.id = new.staff_user_id;
  if target_role is distinct from 'staff' then
    raise exception 'Assignments require an active Growity staff account.' using errcode = '42501';
  end if;
  if (new.assignment_type = 'caseworker' and target_sub_role is distinct from 'caseworker')
    or (new.assignment_type = 'verification' and target_sub_role is distinct from 'verification_team')
    or (new.assignment_type in ('protection', 'on_call') and target_sub_role is distinct from 'protection_officer') then
    raise exception 'The assignment type does not match the staff sub-role.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_assignment_staff_role() from public, anon, authenticated;
create trigger staff_assignment_role_guard
before insert or update on public.staff_assignments
for each row execute function public.enforce_assignment_staff_role();

create or replace function public.enforce_on_call_staff_role()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_role text;
  target_sub_role text;
begin
  select p.role, p.sub_role into target_role, target_sub_role
  from public.profiles p where p.id = new.staff_user_id;
  if target_role is distinct from 'staff' or target_sub_role is distinct from 'protection_officer' then
    raise exception 'Only protection officers can be scheduled on call.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_on_call_staff_role() from public, anon, authenticated;
create trigger staff_on_call_role_guard
before insert or update on public.staff_on_call
for each row execute function public.enforce_on_call_staff_role();

-- Every complaint is routed to a protection officer; emergencies alert all active on-call officers and use a 24-hour deadline.
create or replace function public.assign_emergency_to_on_call()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  selected_officer uuid;
  assignment_count integer;
begin
  if new.urgency = 'emergency' then
    insert into public.staff_assignments(staff_user_id, complaint_id, assignment_type, active)
    select roster.staff_user_id, new.id, 'on_call', true
    from public.staff_on_call as roster
    join public.profiles as p on p.id = roster.staff_user_id
    where roster.active = true and roster.starts_at <= now() and roster.ends_at > now()
      and p.role = 'staff' and p.sub_role = 'protection_officer';
    get diagnostics assignment_count = row_count;
    if assignment_count > 0 then return new; end if;
  end if;
  select p.id into selected_officer
  from public.profiles p
  where p.role = 'staff' and p.sub_role = 'protection_officer'
  order by (
    select count(*) from public.staff_assignments sa
    where sa.staff_user_id = p.id and sa.complaint_id is not null and sa.active = true
  ), p.id
  limit 1;
  if selected_officer is not null then
    insert into public.staff_assignments(staff_user_id, complaint_id, assignment_type, active)
    values (selected_officer, new.id, 'protection', true);
  end if;
  return new;
end;
$$;
revoke all on function public.assign_emergency_to_on_call() from public, anon, authenticated;

commit;
