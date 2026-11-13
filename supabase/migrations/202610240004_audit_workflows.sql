begin;

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

  if p_entity_table = 'complaint_list' and p_entity_id is null and p_action = 'complaint_list' then
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
    allowed := exists (
      select 1 from public.child_private cp
      where cp.child_id = p_entity_id and app_private.can_access_child(cp.child_id)
    );
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
    allowed := app_private.current_role() = 'staff'
      and app_private.current_sub_role() = 'caseworker'
      and app_private.staff_mfa_verified()
      and exists (select 1 from public.foster_interests f where f.id = p_entity_id and f.assigned_caseworker_id = actor);
  elsif p_entity_table = 'data_rights_requests' then
    allowed := exists (
      select 1 from public.data_rights_requests r
      where r.id = p_entity_id and (r.user_id = actor or (app_private.current_role() = 'staff' and app_private.current_sub_role() in ('verification_team', 'caseworker') and app_private.staff_mfa_verified() and exists (select 1 from public.children c where c.user_id = r.user_id and app_private.is_assigned_to_child(c.id))))
    );
  elsif p_entity_table = 'staff_grievances' then
    allowed := app_private.current_role() = 'staff'
      and app_private.current_sub_role() = 'grievance_committee'
      and app_private.staff_mfa_verified()
      and exists (select 1 from public.staff_grievances g where g.id = p_entity_id);
  end if;

  if not allowed then raise exception 'Not authorized.' using errcode = '42501'; end if;
  if p_entity_table = 'staff_grievances' then
    insert into public.audit_log(actor_id, entity_table, entity_id, action)
      values (null, 'staff_grievances', null, 'view');
  else
    insert into public.audit_log(actor_id, entity_table, entity_id, action)
      values (actor, p_entity_table, p_entity_id, p_action);
  end if;
end;
$$;

revoke all on function public.log_audit_event(text, uuid, text) from public, anon;
grant execute on function public.log_audit_event(text, uuid, text) to authenticated;

commit;
