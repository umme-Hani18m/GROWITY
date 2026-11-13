begin;

create or replace function public.record_adoption_tracker_step(
  p_application_id uuid,
  p_step text,
  p_step_date date,
  p_carings_registration_number text,
  p_referral_reference text,
  p_adoption_order_number text,
  p_adoption_order_date date,
  p_child_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  actor uuid := (select auth.uid());
  created_tracker_id uuid;
  next_status text;
begin
  if actor is null
    or app_private.current_role() <> 'staff'
    or app_private.current_sub_role() not in ('verification_team', 'caseworker')
    or not app_private.staff_mfa_verified()
    or not app_private.is_assigned_to_parent(p_application_id)
    or p_step not in ('documents_submitted', 'documents_verified', 'in_person_check', 'carings_registered', 'home_study_done', 'child_referred', 'child_reserved', 'pre_adoption_foster_care', 'adoption_order_issued', 'post_adoption_follow_up') then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  if p_step = 'carings_registered' and length(trim(coalesce(p_carings_registration_number, ''))) not between 1 and 100 then
    raise exception 'A CARINGS registration number is required.' using errcode = '22023';
  end if;
  if p_step = 'adoption_order_issued' and (length(trim(coalesce(p_adoption_order_number, ''))) not between 1 and 100 or p_adoption_order_date is null) then
    raise exception 'An adoption order number and date are required.' using errcode = '22023';
  end if;
  if p_step = 'child_referred' then
    if p_child_id is null
      or length(trim(coalesce(p_referral_reference, ''))) not between 1 and 100
      or app_private.current_sub_role() <> 'caseworker'
      or not app_private.is_assigned_to_child(p_child_id) then
      raise exception 'A caseworker and a recorded official referral are required.' using errcode = '42501';
    end if;
    insert into public.parent_child_referrals(application_id, child_id, referral_reference, entered_by)
    values (p_application_id, p_child_id, trim(p_referral_reference), actor);
  elsif p_step in ('child_reserved', 'pre_adoption_foster_care', 'adoption_order_issued', 'post_adoption_follow_up') then
    if p_child_id is null or not exists (
      select 1 from public.parent_child_referrals r
      where r.application_id = p_application_id and r.child_id = p_child_id
    ) then
      raise exception 'An existing official referral is required.' using errcode = '42501';
    end if;
  end if;

  insert into public.adoption_tracker(
    application_id, step, step_date, carings_registration_number,
    referral_reference, adoption_order_number, adoption_order_date, entered_by
  ) values (
    p_application_id, p_step, p_step_date,
    nullif(trim(coalesce(p_carings_registration_number, '')), ''),
    nullif(trim(coalesce(p_referral_reference, '')), ''),
    nullif(trim(coalesce(p_adoption_order_number, '')), ''),
    p_adoption_order_date, actor
  ) returning id into created_tracker_id;

  next_status := case p_step
    when 'documents_submitted' then 'submitted'
    when 'documents_verified' then 'verified'
    when 'in_person_check' then 'in_person_check'
    when 'carings_registered' then 'verified'
    when 'home_study_done' then 'home_study'
    when 'child_referred' then 'referred'
    when 'child_reserved' then 'reserved'
    when 'pre_adoption_foster_care' then 'pre_adoption_care'
    when 'adoption_order_issued' then 'order_issued'
    when 'post_adoption_follow_up' then 'follow_up'
    else null
  end;
  if next_status is not null then
    update public.parent_applications set status = next_status where id = p_application_id;
  end if;
  return created_tracker_id;
end;
$$;
revoke all on function public.record_adoption_tracker_step(uuid, text, date, text, text, text, date, uuid) from public, anon;
grant execute on function public.record_adoption_tracker_step(uuid, text, date, text, text, text, date, uuid) to authenticated;

commit;
