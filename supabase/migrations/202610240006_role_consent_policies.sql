begin;

drop policy consents_user_insert on public.consents;

create policy consents_user_insert
on public.consents for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (
    ((select app_private.current_role()) = 'parent' and consent_type in ('parent_signup', 'document_upload'))
    or ((select app_private.current_role()) = 'child' and consent_type in ('child_complaint', 'document_upload'))
    or ((select app_private.current_role()) = 'adult_after_care' and consent_type in ('adult_after_care_first_login', 'document_upload'))
    or ((select app_private.current_role()) = 'ngo' and consent_type in ('ngo_onboarding', 'document_upload'))
    or ((select app_private.current_role()) = 'staff' and (select app_private.staff_mfa_verified()) and consent_type = 'staff_code_conduct')
  )
);

create policy consents_assigned_staff_child_upload_insert
on public.consents for insert to authenticated
with check (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('caseworker', 'verification_team')
  and (select app_private.staff_mfa_verified())
  and consent_type = 'document_upload'
  and actor_user_id = (select auth.uid())
  and exists (
    select 1 from public.children c
    where c.user_id = consents.user_id and (select app_private.is_assigned_to_child(c.id))
  )
);

commit;
