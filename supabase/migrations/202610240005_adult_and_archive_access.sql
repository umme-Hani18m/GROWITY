begin;

create policy child_private_adult_self_read
on public.child_private for select to authenticated
using (
  (select app_private.current_role()) = 'adult_after_care'
  and exists (
    select 1 from public.children c
    where c.id = child_private.child_id and c.user_id = (select auth.uid())
  )
);

-- Only assigned, MFA-verified staff may add the legal order or official photo to a family's archive, and only after the order step is recorded.
create policy parent_documents_archive_staff_insert
on public.parent_documents for insert to authenticated
with check (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('caseworker', 'verification_team')
  and (select app_private.staff_mfa_verified())
  and document_type in ('adoption_order', 'official_photo')
  and verification_status = 'verified'
  and verified_by = (select auth.uid())
  and verified_at is not null
  and exists (
    select 1 from public.parent_applications a
    where a.id = application_id and a.user_id = owner_user_id
      and (select app_private.is_assigned_to_parent(a.id))
  )
  and exists (
    select 1 from public.adoption_tracker t
    where t.application_id = parent_documents.application_id
      and t.step = 'adoption_order_issued'
      and t.adoption_order_number is not null
      and t.adoption_order_date is not null
  )
  and storage_path like ('parent/' || owner_user_id::text || '/%')
);

create policy private_doc_parent_archive_staff_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'parent'
  and (storage.foldername(name))[3] = 'archive'
  and (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('caseworker', 'verification_team')
  and (select app_private.staff_mfa_verified())
  and exists (
    select 1 from public.parent_applications a
    where a.user_id::text = (storage.foldername(name))[2]
      and (select app_private.is_assigned_to_parent(a.id))
      and exists (
        select 1 from public.adoption_tracker t
        where t.application_id = a.id
          and t.step = 'adoption_order_issued'
          and t.adoption_order_number is not null
          and t.adoption_order_date is not null
      )
  )
);

commit;
