begin;

-- Adults after care may inspect only their own recorded consent history and data-rights requests.
drop policy if exists consents_adult_aftercare_self_read on public.consents;
create policy consents_adult_aftercare_self_read
on public.consents for select to authenticated
using (
  user_id = (select auth.uid())
  and (select app_private.current_role()) = 'adult_after_care'
);

drop policy if exists data_rights_adult_aftercare_self_read on public.data_rights_requests;
create policy data_rights_adult_aftercare_self_read
on public.data_rights_requests for select to authenticated
using (
  user_id = (select auth.uid())
  and (select app_private.current_role()) = 'adult_after_care'
);

commit;
