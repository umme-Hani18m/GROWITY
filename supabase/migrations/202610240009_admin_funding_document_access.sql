begin;

-- Administrators may inspect only a funding-support document linked to an active request.
drop policy if exists documents_admin_funding_support_read on public.documents;
create policy documents_admin_funding_support_read
on public.documents for select to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'admin'
  and (select app_private.staff_mfa_verified())
  and document_type = 'funding_support'
  and exists (
    select 1 from public.funding_requests fr
    where fr.support_document_id = documents.id
      and fr.status in ('submitted', 'under_review')
  )
);

drop policy if exists private_doc_admin_funding_support_read on storage.objects;
create policy private_doc_admin_funding_support_read
on storage.objects for select to authenticated
using (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'ngo'
  and (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'admin'
  and (select app_private.staff_mfa_verified())
  and exists (
    select 1
    from public.documents d
    join public.funding_requests fr on fr.support_document_id = d.id
    where d.storage_path = name
      and d.document_type = 'funding_support'
      and fr.status in ('submitted', 'under_review')
  )
);

create or replace function public.log_admin_funding_document_access(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null
    or app_private.current_role() <> 'staff'
    or app_private.current_sub_role() <> 'admin'
    or not app_private.staff_mfa_verified()
    or not exists (
      select 1
      from public.documents d
      join public.funding_requests fr on fr.support_document_id = d.id
      where d.id = p_document_id
        and d.document_type = 'funding_support'
        and fr.status in ('submitted', 'under_review')
    ) then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  insert into public.audit_log(actor_id, entity_table, entity_id, action)
  values (actor, 'documents', p_document_id, 'document_download');
end;
$$;
revoke all on function public.log_admin_funding_document_access(uuid) from public, anon;
grant execute on function public.log_admin_funding_document_access(uuid) to authenticated;

commit;
