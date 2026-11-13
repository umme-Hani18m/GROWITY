begin;

create table public.staff_on_call (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.profiles(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_on_call_time_order check (starts_at < ends_at)
);
create index staff_on_call_active_time_idx on public.staff_on_call(active, starts_at, ends_at);
create trigger staff_on_call_updated_at before update on public.staff_on_call for each row execute function public.set_updated_at();

create table public.ngo_reports (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngos(id) on delete restrict,
  report_month date not null,
  new_entries_count integer not null check (new_entries_count >= 0),
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ngo_id, report_month)
);
create index ngo_reports_period_idx on public.ngo_reports(ngo_id, report_month desc);
create trigger ngo_reports_updated_at before update on public.ngo_reports for each row execute function public.set_updated_at();

create table public.data_rights_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  request_type text not null check (request_type in ('download', 'delete_non_legal_data', 'legal_record_access')),
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'approved', 'rejected', 'completed')),
  reason text,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_rights_review_fields_check check ((reviewed_by is null and reviewed_at is null) or (reviewed_by is not null and reviewed_at is not null))
);
create index data_rights_user_status_idx on public.data_rights_requests(user_id, status, created_at desc);
create trigger data_rights_updated_at before update on public.data_rights_requests for each row execute function public.set_updated_at();

create or replace function app_private.current_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select p.role from public.profiles as p where p.id = (select auth.uid())
$$;

create or replace function app_private.current_sub_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select p.sub_role from public.profiles as p where p.id = (select auth.uid())
$$;

create or replace function app_private.current_ngo_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select p.ngo_id from public.profiles as p where p.id = (select auth.uid())
$$;

create or replace function app_private.staff_mfa_verified()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, auth
as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
$$;

create or replace function app_private.is_assigned_to_child(p_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1 from public.staff_assignments as sa
    where sa.staff_user_id = (select auth.uid())
      and sa.child_id = p_child_id
      and sa.active = true
      and sa.assignment_type in ('caseworker', 'verification', 'protection')
  ) or exists (
    select 1 from public.children as c
    where c.id = p_child_id and c.assigned_caseworker_id = (select auth.uid())
  )
$$;

create or replace function app_private.is_assigned_to_parent(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1 from public.staff_assignments as sa
    where sa.staff_user_id = (select auth.uid())
      and sa.parent_application_id = p_application_id
      and sa.active = true
      and sa.assignment_type in ('caseworker', 'verification')
  )
$$;

create or replace function app_private.is_assigned_to_complaint(p_complaint_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1 from public.staff_assignments as sa
    where sa.staff_user_id = (select auth.uid())
      and sa.complaint_id = p_complaint_id
      and sa.active = true
      and sa.assignment_type in ('protection', 'on_call')
  ) or exists (
    select 1 from public.complaints as c
    where c.id = p_complaint_id and c.assigned_protection_officer = (select auth.uid())
  )
$$;

create or replace function app_private.can_access_child(p_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select
    exists (select 1 from public.children c where c.id = p_child_id and c.user_id = (select auth.uid()))
    or (select app_private.current_role()) = 'ngo' and exists (
      select 1 from public.children c where c.id = p_child_id and c.ngo_id = (select app_private.current_ngo_id())
    )
    or (select app_private.current_role()) = 'parent' and exists (
      select 1 from public.parent_child_referrals r
      join public.parent_applications a on a.id = r.application_id
      where r.child_id = p_child_id and a.user_id = (select auth.uid())
    )
    or (select app_private.current_role()) = 'staff'
       and (select app_private.current_sub_role()) in ('caseworker', 'verification_team')
       and (select app_private.staff_mfa_verified())
       and (select app_private.is_assigned_to_child(p_child_id))
    or (select app_private.current_role()) = 'staff'
       and (select app_private.current_sub_role()) = 'protection_officer'
       and (select app_private.staff_mfa_verified())
       and exists (select 1 from public.complaints c where c.child_id = p_child_id and app_private.is_assigned_to_complaint(c.id))
$$;

revoke all on function app_private.current_role() from public, anon;
revoke all on function app_private.current_sub_role() from public, anon;
revoke all on function app_private.current_ngo_id() from public, anon;
revoke all on function app_private.staff_mfa_verified() from public, anon;
revoke all on function app_private.is_assigned_to_child(uuid) from public, anon;
revoke all on function app_private.is_assigned_to_parent(uuid) from public, anon;
revoke all on function app_private.is_assigned_to_complaint(uuid) from public, anon;
revoke all on function app_private.can_access_child(uuid) from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.current_role() to authenticated;
grant execute on function app_private.current_sub_role() to authenticated;
grant execute on function app_private.current_ngo_id() to authenticated;
grant execute on function app_private.staff_mfa_verified() to authenticated;
grant execute on function app_private.is_assigned_to_child(uuid) to authenticated;
grant execute on function app_private.is_assigned_to_parent(uuid) to authenticated;
grant execute on function app_private.is_assigned_to_complaint(uuid) to authenticated;
grant execute on function app_private.can_access_child(uuid) to authenticated;

create or replace function public.consume_child_login_attempt(p_request_hash text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_count integer;
begin
  if p_request_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  delete from public.child_login_limits where window_started_at < now() - interval '1 day';
  insert into public.child_login_limits(request_hash, window_started_at, attempt_count)
  values (p_request_hash, now(), 1)
  on conflict (request_hash) do update
    set window_started_at = case when public.child_login_limits.window_started_at < now() - interval '15 minutes' then now() else public.child_login_limits.window_started_at end,
        attempt_count = case when public.child_login_limits.window_started_at < now() - interval '15 minutes' then 1 else public.child_login_limits.attempt_count + 1 end,
        updated_at = now()
  returning attempt_count into current_count;
  return current_count <= 5;
end;
$$;

create or replace function public.consume_public_submission_attempt(p_request_hash text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_count integer;
begin
  if p_request_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  delete from public.public_submission_limits where window_started_at < now() - interval '1 day';
  insert into public.public_submission_limits(request_hash, window_started_at, attempt_count)
  values (p_request_hash, now(), 1)
  on conflict (request_hash) do update
    set window_started_at = case when public.public_submission_limits.window_started_at < now() - interval '1 hour' then now() else public.public_submission_limits.window_started_at end,
        attempt_count = case when public.public_submission_limits.window_started_at < now() - interval '1 hour' then 1 else public.public_submission_limits.attempt_count + 1 end,
        updated_at = now()
  returning attempt_count into current_count;
  return current_count <= 5;
end;
$$;

create or replace function public.submit_foster_interest(
  p_name text,
  p_contact text,
  p_state text,
  p_consent_version text,
  p_request_hash text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  created_interest uuid;
begin
  if length(trim(p_name)) not between 1 and 120
    or length(trim(p_contact)) not between 7 and 254
    or length(trim(p_state)) not between 1 and 120
    or length(trim(p_consent_version)) not between 1 and 80
    or p_request_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  if not public.consume_public_submission_attempt(p_request_hash) then return false; end if;
  insert into public.foster_interests(name, contact, state)
  values (trim(p_name), trim(p_contact), trim(p_state))
  returning id into created_interest;
  insert into public.consents(foster_interest_id, consent_type, document_version)
  values (created_interest, 'foster_interest', p_consent_version);
  return true;
end;
$$;

create or replace function public.record_funding_approval(p_request_id uuid, p_decision text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  existing public.funding_requests%rowtype;
  caller uuid := (select auth.uid());
begin
  if caller is null
    or app_private.current_role() <> 'staff'
    or app_private.current_sub_role() <> 'admin'
    or not app_private.staff_mfa_verified()
    or p_decision not in ('approve', 'reject') then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  select * into existing from public.funding_requests where id = p_request_id for update;
  if not found or existing.status not in ('submitted', 'under_review') then raise exception 'Request unavailable.'; end if;
  if existing.approver_one_id is null then
    update public.funding_requests
      set approver_one_id = caller,
          approver_one_at = now(),
          status = case when p_decision = 'reject' then 'rejected' else 'under_review' end
      where id = p_request_id;
    return case when p_decision = 'reject' then 'rejected' else 'first_approval_recorded' end;
  end if;
  if existing.approver_one_id = caller then raise exception 'A different administrator must decide.' using errcode = '42501'; end if;
  if existing.approver_two_id is not null then raise exception 'Request already has two decisions.'; end if;
  update public.funding_requests
    set approver_two_id = caller,
        approver_two_at = now(),
        status = case when p_decision = 'reject' then 'rejected' else 'approved' end
    where id = p_request_id;
  return case when p_decision = 'reject' then 'rejected' else 'approved' end;
end;
$$;

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
  if p_entity_table = 'complaint_list' and p_entity_id is null then
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
  elsif p_entity_table = 'staff_grievances' then
    allowed := app_private.current_role() = 'staff' and app_private.current_sub_role() = 'grievance_committee' and app_private.staff_mfa_verified()
      and exists (select 1 from public.staff_grievances g where g.id = p_entity_id);
  end if;
  if not allowed then raise exception 'Not authorized.' using errcode = '42501'; end if;
  if p_entity_table = 'staff_grievances' then
    insert into public.audit_log(actor_id, entity_table, entity_id, action) values (null, 'staff_grievances', null, 'view');
  else
    insert into public.audit_log(actor_id, entity_table, entity_id, action) values (actor, p_entity_table, p_entity_id, p_action);
  end if;
end;
$$;

create or replace function public.prevent_append_only_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'This record is append-only.' using errcode = '42501';
end;
$$;

create or replace function public.audit_sensitive_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  subject_id uuid;
  action_value text;
  actor uuid := (select auth.uid());
begin
  if tg_op = 'DELETE' then
    if tg_table_name = 'child_private' then subject_id := old.child_id; else subject_id := old.id; end if;
    action_value := 'delete';
  elsif tg_op = 'INSERT' then
    if tg_table_name = 'child_private' then subject_id := new.child_id; else subject_id := new.id; end if;
    action_value := 'create';
  else
    if tg_table_name = 'child_private' then subject_id := new.child_id; else subject_id := new.id; end if;
    action_value := 'update';
  end if;
  if tg_table_name = 'staff_grievances' and coalesce((case when tg_op = 'DELETE' then old.is_anonymous else new.is_anonymous end), false) then
    insert into public.audit_log(actor_id, entity_table, entity_id, action) values (null, tg_table_name, null, action_value);
  else
    insert into public.audit_log(actor_id, entity_table, entity_id, action) values (actor, tg_table_name, subject_id, action_value);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

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
  order by (select count(*) from public.staff_assignments sa where sa.staff_user_id = p.id and sa.complaint_id is not null and sa.active = true), p.id
  limit 1;
  if selected_officer is not null then
    insert into public.staff_assignments(staff_user_id, complaint_id, assignment_type, active)
    values (selected_officer, new.id, 'protection', true);
  end if;
  return new;
end;
$$;

create or replace function public.record_initial_complaint_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  insert into public.complaint_events(complaint_id, event_type, event_summary, is_child_visible, actor_user_id)
  values (new.id, 'status_changed', 'Report received.', true, new.reporter_user_id);
  return new;
end;
$$;

revoke all on function public.consume_child_login_attempt(text) from public, anon, authenticated;
revoke all on function public.consume_public_submission_attempt(text) from public, anon, authenticated;
revoke all on function public.submit_foster_interest(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.record_funding_approval(uuid, text) from public, anon;
revoke all on function public.log_audit_event(text, uuid, text) from public, anon;
revoke all on function public.prevent_append_only_mutation() from public, anon, authenticated;
revoke all on function public.audit_sensitive_change() from public, anon, authenticated;
revoke all on function public.assign_emergency_to_on_call() from public, anon, authenticated;
revoke all on function public.record_initial_complaint_event() from public, anon, authenticated;
grant execute on function public.consume_child_login_attempt(text) to service_role;
grant execute on function public.consume_public_submission_attempt(text) to service_role;
grant execute on function public.submit_foster_interest(text, text, text, text, text) to service_role;
grant execute on function public.record_funding_approval(uuid, text) to authenticated;
grant execute on function public.log_audit_event(text, uuid, text) to authenticated;

create trigger complaints_assign_on_call after insert on public.complaints for each row execute function public.assign_emergency_to_on_call();
create trigger complaints_initial_event after insert on public.complaints for each row execute function public.record_initial_complaint_event();
create trigger complaint_events_append_only before update or delete on public.complaint_events for each row execute function public.prevent_append_only_mutation();
create trigger audit_log_append_only before update or delete on public.audit_log for each row execute function public.prevent_append_only_mutation();
create trigger audit_children after insert or update or delete on public.children for each row execute function public.audit_sensitive_change();
create trigger audit_child_private after insert or update or delete on public.child_private for each row execute function public.audit_sensitive_change();
create trigger audit_documents after insert or update or delete on public.documents for each row execute function public.audit_sensitive_change();
create trigger audit_parent_documents after insert or update or delete on public.parent_documents for each row execute function public.audit_sensitive_change();
create trigger audit_adoption_tracker after insert or update or delete on public.adoption_tracker for each row execute function public.audit_sensitive_change();
create trigger audit_complaints after insert or update or delete on public.complaints for each row execute function public.audit_sensitive_change();
create trigger audit_foster_interests after insert or update or delete on public.foster_interests for each row execute function public.audit_sensitive_change();
create trigger audit_support_requests after insert or update or delete on public.support_requests for each row execute function public.audit_sensitive_change();
create trigger audit_staff_grievances after insert or update or delete on public.staff_grievances for each row execute function public.audit_sensitive_change();
create trigger audit_funding_requests after insert or update or delete on public.funding_requests for each row execute function public.audit_sensitive_change();

alter table public.profiles enable row level security;
alter table public.ngos enable row level security;
alter table public.children enable row level security;
alter table public.child_private enable row level security;
alter table public.parent_applications enable row level security;
alter table public.staff_assignments enable row level security;
alter table public.documents enable row level security;
alter table public.parent_documents enable row level security;
alter table public.adoption_tracker enable row level security;
alter table public.parent_child_referrals enable row level security;
alter table public.foster_interests enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_events enable row level security;
alter table public.support_requests enable row level security;
alter table public.staff_grievances enable row level security;
alter table public.funding_requests enable row level security;
alter table public.audit_log enable row level security;
alter table public.consents enable row level security;
alter table public.public_submission_limits enable row level security;
alter table public.child_login_limits enable row level security;
alter table public.staff_on_call enable row level security;
alter table public.ngo_reports enable row level security;
alter table public.data_rights_requests enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.ngos from anon, authenticated;
revoke all on table public.children from anon, authenticated;
revoke all on table public.child_private from anon, authenticated;
revoke all on table public.parent_applications from anon, authenticated;
revoke all on table public.staff_assignments from anon, authenticated;
revoke all on table public.documents from anon, authenticated;
revoke all on table public.parent_documents from anon, authenticated;
revoke all on table public.adoption_tracker from anon, authenticated;
revoke all on table public.parent_child_referrals from anon, authenticated;
revoke all on table public.foster_interests from anon, authenticated;
revoke all on table public.complaints from anon, authenticated;
revoke all on table public.complaint_events from anon, authenticated;
revoke all on table public.support_requests from anon, authenticated;
revoke all on table public.staff_grievances from anon, authenticated;
revoke all on table public.funding_requests from anon, authenticated;
revoke all on table public.audit_log from anon, authenticated;
revoke all on table public.consents from anon, authenticated;
revoke all on table public.public_submission_limits from anon, authenticated;
revoke all on table public.child_login_limits from anon, authenticated;
revoke all on table public.staff_on_call from anon, authenticated;
revoke all on table public.ngo_reports from anon, authenticated;
revoke all on table public.data_rights_requests from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update on table public.ngos to authenticated;
grant select, insert on table public.children to authenticated;
grant select on table public.child_private to authenticated;
grant select, insert on table public.parent_applications to authenticated;
grant update (preferred_religion, preferred_age_min, preferred_age_max) on table public.parent_applications to authenticated;
grant select, insert, update on table public.staff_assignments to authenticated;
grant select, insert on table public.documents to authenticated;
grant update (verified_by) on table public.documents to authenticated;
grant select, insert on table public.parent_documents to authenticated;
grant update (verification_status, verified_by, verified_at) on table public.parent_documents to authenticated;
grant select, insert, update on table public.adoption_tracker to authenticated;
grant select, insert on table public.parent_child_referrals to authenticated;
grant select on table public.foster_interests to authenticated;
grant update (status, forwarded_to_dcpu, cwc_decision) on table public.foster_interests to authenticated;
grant select, insert on table public.complaints to authenticated;
grant update (status, outcome_contacted, outcome_contacted_at, outcome_method, outcome_notes, outcome_recorded_by, child_visible) on table public.complaints to authenticated;
grant select, insert on table public.complaint_events to authenticated;
grant select, insert on table public.support_requests to authenticated;
grant update (status) on table public.support_requests to authenticated;
grant select, insert on table public.staff_grievances to authenticated;
grant update (status) on table public.staff_grievances to authenticated;
grant select, insert on table public.funding_requests to authenticated;
grant select on table public.audit_log to authenticated;
grant select, insert on table public.consents to authenticated;
grant select, insert, update on table public.staff_on_call to authenticated;
grant select, insert, update on table public.ngo_reports to authenticated;
grant select, insert on table public.data_rights_requests to authenticated;
grant update (status, reviewed_by, reviewed_at) on table public.data_rights_requests to authenticated;

create policy profiles_self_or_admin_staff_directory
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or ((select app_private.current_role()) = 'staff'
      and (select app_private.current_sub_role()) = 'admin'
      and (select app_private.staff_mfa_verified())
      and role = 'staff')
);
create policy profiles_admin_update_accounts
on public.profiles for update to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'admin'
  and (select app_private.staff_mfa_verified())
  and role in ('staff', 'ngo')
)
with check (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'admin'
  and (select app_private.staff_mfa_verified())
  and ((role = 'staff' and sub_role in ('verification_team', 'caseworker', 'protection_officer', 'grievance_committee', 'admin'))
    or (role = 'ngo' and sub_role is null and ngo_id is not null
      and exists (select 1 from public.ngos n where n.id = ngo_id and n.verification_status = 'verified')))
);

create policy ngos_member_read
on public.ngos for select to authenticated
using (
  id = (select app_private.current_ngo_id())
  or ((select app_private.current_role()) = 'staff'
      and (select app_private.current_sub_role()) in ('admin', 'verification_team')
      and (select app_private.staff_mfa_verified()))
);
create policy ngos_admin_insert
on public.ngos for insert to authenticated
with check ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'admin' and (select app_private.staff_mfa_verified()));
create policy ngos_admin_update
on public.ngos for update to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'admin' and (select app_private.staff_mfa_verified()))
with check ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'admin' and (select app_private.staff_mfa_verified()));

create policy children_child_own_read
on public.children for select to authenticated
using (user_id = (select auth.uid()) and (select app_private.current_role()) in ('child', 'adult_after_care'));
create policy children_ngo_own_read
on public.children for select to authenticated
using ((select app_private.current_role()) = 'ngo' and ngo_id = (select app_private.current_ngo_id()));
create policy children_parent_referral_read
on public.children for select to authenticated
using (
  (select app_private.current_role()) = 'parent'
  and exists (select 1 from public.parent_child_referrals r join public.parent_applications a on a.id = r.application_id where r.child_id = children.id and a.user_id = (select auth.uid()))
);
create policy children_assigned_staff_read
on public.children for select to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('caseworker', 'verification_team')
  and (select app_private.staff_mfa_verified())
  and (select app_private.is_assigned_to_child(id))
);
create policy children_protection_assigned_read
on public.children for select to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'protection_officer'
  and (select app_private.staff_mfa_verified())
  and exists (select 1 from public.complaints c where c.child_id = children.id and (select app_private.is_assigned_to_complaint(c.id)))
);
create policy children_ngo_insert_requires_cwc_order
on public.children for insert to authenticated
with check (
  (select app_private.current_role()) = 'ngo'
  and ngo_id = (select app_private.current_ngo_id())
  and cwc_order_number is not null
  and length(trim(cwc_order_number)) between 1 and 100
  and user_id is null
  and assigned_caseworker_id is null
  and status in ('in_care', 'foster_care')
);

create policy child_private_assigned_caseworker_read
on public.child_private for select to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('caseworker', 'verification_team')
  and (select app_private.staff_mfa_verified())
  and (select app_private.is_assigned_to_child(child_id))
);
create policy child_private_assigned_protection_read
on public.child_private for select to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'protection_officer'
  and (select app_private.staff_mfa_verified())
  and exists (select 1 from public.complaints c where c.child_id = child_private.child_id and (select app_private.is_assigned_to_complaint(c.id)))
);

create policy parent_applications_owner_read
on public.parent_applications for select to authenticated
using (user_id = (select auth.uid()) and (select app_private.current_role()) = 'parent');
create policy parent_applications_owner_insert
on public.parent_applications for insert to authenticated
with check (user_id = (select auth.uid()) and (select app_private.current_role()) = 'parent' and status = 'draft');
create policy parent_applications_owner_update_preferences
on public.parent_applications for update to authenticated
using (user_id = (select auth.uid()) and (select app_private.current_role()) = 'parent')
with check (user_id = (select auth.uid()) and (select app_private.current_role()) = 'parent');
create policy parent_applications_assigned_staff_read
on public.parent_applications for select to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('verification_team', 'caseworker')
  and (select app_private.staff_mfa_verified())
  and (select app_private.is_assigned_to_parent(id))
);
create policy parent_applications_assigned_staff_update
on public.parent_applications for update to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('verification_team', 'caseworker')
  and (select app_private.staff_mfa_verified())
  and (select app_private.is_assigned_to_parent(id))
)
with check (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('verification_team', 'caseworker')
  and (select app_private.staff_mfa_verified())
  and (select app_private.is_assigned_to_parent(id))
);

create policy staff_assignments_self_read
on public.staff_assignments for select to authenticated
using (staff_user_id = (select auth.uid()) and (select app_private.current_role()) = 'staff' and (select app_private.staff_mfa_verified()));
create policy staff_assignments_admin_read
on public.staff_assignments for select to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'admin' and (select app_private.staff_mfa_verified()));
create policy staff_assignments_admin_insert
on public.staff_assignments for insert to authenticated
with check ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'admin' and (select app_private.staff_mfa_verified()));
create policy staff_assignments_admin_update
on public.staff_assignments for update to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'admin' and (select app_private.staff_mfa_verified()))
with check ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'admin' and (select app_private.staff_mfa_verified()));

create policy documents_owner_read
on public.documents for select to authenticated
using (owner_user_id = (select auth.uid()));
create policy documents_child_owner_read
on public.documents for select to authenticated
using (child_id is not null and exists (select 1 from public.children c where c.id = child_id and c.user_id = (select auth.uid()) and (select app_private.current_role()) in ('child', 'adult_after_care')));
create policy documents_child_assigned_staff_read
on public.documents for select to authenticated
using (child_id is not null and (select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) in ('caseworker', 'verification_team', 'protection_officer') and (select app_private.staff_mfa_verified()) and (select app_private.can_access_child(child_id)));
create policy documents_ngo_own_read
on public.documents for select to authenticated
using (ngo_id is not null and ngo_id = (select app_private.current_ngo_id()) and (select app_private.current_role()) = 'ngo');
create policy documents_parent_referral_read
on public.documents for select to authenticated
using (child_id is not null and (select app_private.current_role()) = 'parent' and exists (select 1 from public.parent_child_referrals r join public.parent_applications a on a.id = r.application_id where r.child_id = documents.child_id and a.user_id = (select auth.uid())));
create policy documents_child_upload
on public.documents for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and owner_user_id is null
  and ngo_id is null
  and child_id is not null
  and document_type = 'education'
  and exists (select 1 from public.children c where c.id = child_id and c.user_id = (select auth.uid()))
);
create policy documents_ngo_upload
on public.documents for insert to authenticated
with check (
  (select app_private.current_role()) = 'ngo'
  and uploaded_by = (select auth.uid())
  and ngo_id = (select app_private.current_ngo_id())
  and owner_user_id is null
  and child_id is null
  and document_type in ('recognition', 'compliance', 'funding_support')
);
create policy documents_assigned_staff_upload
on public.documents for insert to authenticated
with check (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('caseworker', 'verification_team')
  and (select app_private.staff_mfa_verified())
  and uploaded_by = (select auth.uid())
  and child_id is not null
  and document_type in ('education', 'care_record')
  and (select app_private.is_assigned_to_child(child_id))
);
create policy documents_assigned_staff_update
on public.documents for update to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('caseworker', 'verification_team')
  and (select app_private.staff_mfa_verified())
  and ((child_id is not null and (select app_private.is_assigned_to_child(child_id))) or (ngo_id is not null and (select app_private.current_sub_role()) = 'verification_team'))
)
with check (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('caseworker', 'verification_team')
  and (select app_private.staff_mfa_verified())
);

create policy parent_documents_owner_read
on public.parent_documents for select to authenticated
using (owner_user_id = (select auth.uid()) and (select app_private.current_role()) = 'parent');
create policy parent_documents_assigned_verification_read
on public.parent_documents for select to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('verification_team', 'caseworker')
  and (select app_private.staff_mfa_verified())
  and (select app_private.is_assigned_to_parent(application_id))
);
create policy parent_documents_owner_insert
on public.parent_documents for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and (select app_private.current_role()) = 'parent'
  and exists (select 1 from public.parent_applications a where a.id = application_id and a.user_id = (select auth.uid()))
  and verification_status = 'submitted'
  and verified_by is null
  and verified_at is null
);
create policy parent_documents_verification_update
on public.parent_documents for update to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'verification_team' and (select app_private.staff_mfa_verified()) and (select app_private.is_assigned_to_parent(application_id)))
with check ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'verification_team' and (select app_private.staff_mfa_verified()) and (select app_private.is_assigned_to_parent(application_id)));

create policy adoption_tracker_parent_read
on public.adoption_tracker for select to authenticated
using ((select app_private.current_role()) = 'parent' and exists (select 1 from public.parent_applications a where a.id = application_id and a.user_id = (select auth.uid())));
create policy adoption_tracker_staff_read
on public.adoption_tracker for select to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) in ('verification_team', 'caseworker') and (select app_private.staff_mfa_verified()) and (select app_private.is_assigned_to_parent(application_id)));
create policy adoption_tracker_staff_insert
on public.adoption_tracker for insert to authenticated
with check ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) in ('verification_team', 'caseworker') and (select app_private.staff_mfa_verified()) and entered_by = (select auth.uid()) and (select app_private.is_assigned_to_parent(application_id)));
create policy adoption_tracker_staff_update
on public.adoption_tracker for update to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) in ('verification_team', 'caseworker') and (select app_private.staff_mfa_verified()) and (select app_private.is_assigned_to_parent(application_id)))
with check ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) in ('verification_team', 'caseworker') and (select app_private.staff_mfa_verified()) and (select app_private.is_assigned_to_parent(application_id)));

create policy parent_referral_owner_read
on public.parent_child_referrals for select to authenticated
using (exists (select 1 from public.parent_applications a where a.id = application_id and a.user_id = (select auth.uid()) and (select app_private.current_role()) = 'parent'));
create policy parent_referral_staff_read
on public.parent_child_referrals for select to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) in ('verification_team', 'caseworker') and (select app_private.staff_mfa_verified()) and (select app_private.is_assigned_to_parent(application_id)));
create policy parent_referral_staff_insert
on public.parent_child_referrals for insert to authenticated
with check ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) in ('verification_team', 'caseworker') and (select app_private.staff_mfa_verified()) and entered_by = (select auth.uid()) and (select app_private.is_assigned_to_parent(application_id)));

create policy foster_interest_assigned_caseworker_read
on public.foster_interests for select to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'caseworker' and (select app_private.staff_mfa_verified()));
create policy foster_interest_assigned_caseworker_update
on public.foster_interests for update to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'caseworker' and (select app_private.staff_mfa_verified()))
with check ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'caseworker' and (select app_private.staff_mfa_verified()));

create policy complaints_child_own_read
on public.complaints for select to authenticated
using (reporter_user_id = (select auth.uid()) and (select app_private.current_role()) in ('child', 'adult_after_care'));
create policy complaints_child_insert
on public.complaints for insert to authenticated
with check (
  reporter_user_id = (select auth.uid())
  and (select app_private.current_role()) = 'child'
  and exists (select 1 from public.children c where c.id = child_id and c.user_id = (select auth.uid()))
  and assigned_protection_officer is null
  and outcome_contacted is null
  and outcome_contacted_at is null
  and outcome_method is null
  and outcome_recorded_by is null
  and status = 'open'
);
create policy complaints_protection_assigned_read
on public.complaints for select to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'protection_officer' and (select app_private.staff_mfa_verified()) and (select app_private.is_assigned_to_complaint(id)));
create policy complaints_protection_assigned_update
on public.complaints for update to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'protection_officer' and (select app_private.staff_mfa_verified()) and (select app_private.is_assigned_to_complaint(id)))
with check ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'protection_officer' and (select app_private.staff_mfa_verified()) and (select app_private.is_assigned_to_complaint(id)));

create policy complaint_events_child_visible_read
on public.complaint_events for select to authenticated
using (
  is_child_visible = true
  and exists (select 1 from public.complaints c where c.id = complaint_id and c.reporter_user_id = (select auth.uid()) and (select app_private.current_role()) in ('child', 'adult_after_care'))
);
create policy complaint_events_protection_read
on public.complaint_events for select to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'protection_officer' and (select app_private.staff_mfa_verified()) and (select app_private.is_assigned_to_complaint(complaint_id)));
create policy complaint_events_protection_insert
on public.complaint_events for insert to authenticated
with check ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'protection_officer' and (select app_private.staff_mfa_verified()) and actor_user_id = (select auth.uid()) and (select app_private.is_assigned_to_complaint(complaint_id)));

create policy support_requests_child_read
on public.support_requests for select to authenticated
using (requester_user_id = (select auth.uid()) and (select app_private.current_role()) in ('child', 'adult_after_care'));
create policy support_requests_child_insert
on public.support_requests for insert to authenticated
with check (requester_user_id = (select auth.uid()) and (select app_private.current_role()) = 'child' and exists (select 1 from public.children c where c.id = child_id and c.user_id = (select auth.uid())) and status = 'open');
create policy support_requests_assigned_staff_read
on public.support_requests for select to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) in ('caseworker', 'verification_team') and (select app_private.staff_mfa_verified()) and (select app_private.is_assigned_to_child(child_id)));
create policy support_requests_assigned_staff_update
on public.support_requests for update to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) in ('caseworker', 'verification_team') and (select app_private.staff_mfa_verified()) and (select app_private.is_assigned_to_child(child_id)))
with check ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) in ('caseworker', 'verification_team') and (select app_private.staff_mfa_verified()) and (select app_private.is_assigned_to_child(child_id)));

create policy grievances_committee_read
on public.staff_grievances for select to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'grievance_committee' and (select app_private.staff_mfa_verified()));
create policy grievances_staff_insert
on public.staff_grievances for insert to authenticated
with check (
  (select app_private.current_role()) = 'staff'
  and (select app_private.staff_mfa_verified())
  and ((is_anonymous = true and created_by is null) or (is_anonymous = false and created_by = (select auth.uid())))
  and status = 'open'
);
create policy grievances_committee_update_status
on public.staff_grievances for update to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'grievance_committee' and (select app_private.staff_mfa_verified()))
with check ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'grievance_committee' and (select app_private.staff_mfa_verified()));

create policy funding_ngo_read
on public.funding_requests for select to authenticated
using ((select app_private.current_role()) = 'ngo' and ngo_id = (select app_private.current_ngo_id()));
create policy funding_admin_read
on public.funding_requests for select to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'admin' and (select app_private.staff_mfa_verified()));
create policy funding_ngo_insert
on public.funding_requests for insert to authenticated
with check (
  (select app_private.current_role()) = 'ngo'
  and ngo_id = (select app_private.current_ngo_id())
  and created_by = (select auth.uid())
  and status = 'submitted'
  and approver_one_id is null and approver_two_id is null
  and exists (select 1 from public.documents d where d.id = support_document_id and d.ngo_id = (select app_private.current_ngo_id()) and d.document_type = 'funding_support')
);
create or replace function public.enforce_funding_two_admins()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  first_role text;
  second_role text;
begin
  if new.approver_one_id is not null then
    select sub_role into first_role from public.profiles where id = new.approver_one_id and role = 'staff';
    if first_role is distinct from 'admin' then raise exception 'Approval requires an administrator.'; end if;
  end if;
  if new.approver_two_id is not null then
    select sub_role into second_role from public.profiles where id = new.approver_two_id and role = 'staff';
    if second_role is distinct from 'admin' or new.approver_two_id = new.approver_one_id then raise exception 'Second approval requires a different administrator.'; end if;
  end if;
  if new.status in ('approved', 'paid') and (new.approver_one_id is null or new.approver_two_id is null) then raise exception 'Two approvals are required.'; end if;
  return new;
end;
$$;
revoke all on function public.enforce_funding_two_admins() from public, anon, authenticated;
create trigger funding_two_admin_guard before insert or update on public.funding_requests for each row execute function public.enforce_funding_two_admins();

create policy audit_log_no_direct_read
on public.audit_log for select to authenticated
using (false);
create policy consents_user_read
on public.consents for select to authenticated
using (user_id = (select auth.uid()));
create policy consents_assigned_staff_read
on public.consents for select to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) in ('caseworker', 'verification_team') and (select app_private.staff_mfa_verified()) and actor_user_id = (select auth.uid()));
create policy consents_user_insert
on public.consents for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (
    (select app_private.current_role()) in ('parent', 'adult_after_care', 'child')
    or ((select app_private.current_role()) = 'staff' and (select app_private.staff_mfa_verified()) and consent_type = 'staff_code_conduct')
  )
);
create policy consents_assigned_staff_read_subject
on public.consents for select to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('caseworker', 'verification_team')
  and (select app_private.staff_mfa_verified())
  and (
    (user_id is not null and exists (
      select 1 from public.children c where c.user_id = consents.user_id and app_private.is_assigned_to_child(c.id)
    ))
    or (user_id is not null and exists (
      select 1 from public.parent_applications a where a.user_id = consents.user_id and app_private.is_assigned_to_parent(a.id)
    ))
    or (foster_interest_id is not null and (select app_private.current_sub_role()) = 'caseworker')
  )
);

create policy staff_on_call_admin_read
on public.staff_on_call for select to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'admin' and (select app_private.staff_mfa_verified()));
create policy staff_on_call_admin_insert
on public.staff_on_call for insert to authenticated
with check ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'admin' and (select app_private.staff_mfa_verified()));
create policy staff_on_call_admin_update
on public.staff_on_call for update to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'admin' and (select app_private.staff_mfa_verified()))
with check ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) = 'admin' and (select app_private.staff_mfa_verified()));

create policy ngo_reports_ngo_read
on public.ngo_reports for select to authenticated
using ((select app_private.current_role()) = 'ngo' and ngo_id = (select app_private.current_ngo_id()));
create policy ngo_reports_ngo_insert
on public.ngo_reports for insert to authenticated
with check ((select app_private.current_role()) = 'ngo' and ngo_id = (select app_private.current_ngo_id()) and submitted_by = (select auth.uid()));
create policy ngo_reports_admin_read
on public.ngo_reports for select to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) in ('admin', 'verification_team') and (select app_private.staff_mfa_verified()));

create policy data_rights_owner_read
on public.data_rights_requests for select to authenticated
using (user_id = (select auth.uid()));
create policy data_rights_owner_insert
on public.data_rights_requests for insert to authenticated
with check (user_id = (select auth.uid()) and (select app_private.current_role()) in ('adult_after_care', 'parent') and status = 'submitted' and reviewed_by is null and reviewed_at is null);
create policy data_rights_staff_read
on public.data_rights_requests for select to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) in ('verification_team', 'caseworker') and (select app_private.staff_mfa_verified()));
create policy data_rights_staff_update
on public.data_rights_requests for update to authenticated
using ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) in ('verification_team', 'caseworker') and (select app_private.staff_mfa_verified()))
with check ((select app_private.current_role()) = 'staff' and (select app_private.current_sub_role()) in ('verification_team', 'caseworker') and (select app_private.staff_mfa_verified()) and reviewed_by = (select auth.uid()));

alter table public.complaints
  add constraint emergency_closed_requires_recorded_outcome
  check (urgency <> 'emergency' or status <> 'closed' or (outcome_contacted is not null and outcome_contacted_at is not null and outcome_method is not null and outcome_recorded_by is not null));

create or replace function public.set_complaint_deadline()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.urgency = 'emergency' then
    new.due_at := now() + interval '24 hours';
  else
    new.due_at := null;
  end if;
  return new;
end;
$$;
revoke all on function public.set_complaint_deadline() from public, anon, authenticated;
create trigger complaints_set_deadline before insert on public.complaints for each row execute function public.set_complaint_deadline();

create or replace function public.require_outcome_by_assigned_officer()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if new.outcome_contacted is not null and (new.outcome_recorded_by is distinct from (select auth.uid())) then
    raise exception 'The assigned protection officer must record the outcome.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.require_outcome_by_assigned_officer() from public, anon, authenticated;
create trigger complaints_outcome_actor before update on public.complaints for each row execute function public.require_outcome_by_assigned_officer();

create or replace view public.verified_ngos_public
with (security_barrier = true)
as
select id, display_name, recognition_type, recognition_number, recognition_date, state
from public.ngos
where verification_status = 'verified';
grant select on public.verified_ngos_public to anon, authenticated;

create or replace view public.overdue_emergency_cases
with (security_invoker = true)
as
select id, child_id, urgency, status, due_at
from public.complaints
where urgency = 'emergency' and due_at < now() and outcome_contacted is null and status <> 'closed';
grant select on public.overdue_emergency_cases to authenticated;

create unique index consents_user_version_unique on public.consents(user_id, consent_type, document_version) where user_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-documents', 'private-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'];

create policy private_doc_parent_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'parent'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (select app_private.current_role()) = 'parent'
);
create policy private_doc_parent_read
on storage.objects for select to authenticated
using (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'parent'
  and exists (select 1 from public.parent_documents d where d.storage_path = name and d.owner_user_id = (select auth.uid()))
);
create policy private_doc_parent_assigned_staff_read
on storage.objects for select to authenticated
using (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'parent'
  and (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('verification_team', 'caseworker')
  and (select app_private.staff_mfa_verified())
  and exists (select 1 from public.parent_documents d where d.storage_path = name and app_private.is_assigned_to_parent(d.application_id))
);
create policy private_doc_child_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'child'
  and exists (select 1 from public.children c where c.id::text = (storage.foldername(name))[2] and c.user_id = (select auth.uid()))
);
create policy private_doc_child_read
on storage.objects for select to authenticated
using (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'child'
  and exists (select 1 from public.documents d where d.storage_path = name and d.child_id is not null and app_private.can_access_child(d.child_id))
);
create policy private_doc_ngo_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'ngo'
  and (storage.foldername(name))[2] = (select app_private.current_ngo_id())::text
  and (select app_private.current_role()) = 'ngo'
);
create policy private_doc_ngo_read
on storage.objects for select to authenticated
using (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'ngo'
  and exists (select 1 from public.documents d where d.storage_path = name and d.ngo_id = (select app_private.current_ngo_id()) and (select app_private.current_role()) = 'ngo')
);
create policy private_doc_staff_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'child'
  and (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('caseworker', 'verification_team')
  and (select app_private.staff_mfa_verified())
  and exists (select 1 from public.children c where c.id::text = (storage.foldername(name))[2] and app_private.is_assigned_to_child(c.id))
);

commit;
