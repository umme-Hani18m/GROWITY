begin;

create schema if not exists app_private;
revoke all on schema app_private from public, anon;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  role text not null check (role in ('child', 'adult_after_care', 'parent', 'ngo', 'staff')),
  sub_role text check (sub_role is null or sub_role in ('verification_team', 'caseworker', 'protection_officer', 'grievance_committee', 'admin')),
  full_name text,
  language text not null default 'en' check (language in ('en', 'hi', 'bn', 'mr', 'te', 'ta', 'gu', 'ur', 'kn', 'or', 'ml', 'pa', 'as', 'mai', 'bhb', 'sat', 'ks', 'gon', 'ne', 'sd', 'doi', 'kok', 'kru', 'kfy', 'tcy', 'mni', 'brx', 'kha', 'hoc', 'grt', 'unr', 'trp', 'kxu')),
  ngo_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_sub_role_check check ((role = 'staff' and sub_role is not null) or (role <> 'staff' and sub_role is null))
);

create table public.ngos (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(trim(display_name)) between 2 and 180),
  recognition_type text not null check (recognition_type in ('saa', 'cci')),
  registration_number text not null unique,
  recognition_number text not null,
  recognition_date date not null,
  state text not null,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'suspended', 'rejected')),
  verified_by uuid references public.profiles(id) on delete restrict,
  verified_at timestamptz,
  renewal_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ngos_verified_fields_check check ((verification_status = 'verified' and verified_by is not null and verified_at is not null) or verification_status <> 'verified')
);

alter table public.profiles
  add constraint profiles_ngo_id_fkey foreign key (ngo_id) references public.ngos(id) on delete restrict;

create table public.children (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique check (public_code ~ '^[A-Z0-9-]{4,32}$'),
  user_id uuid unique references auth.users(id) on delete set null,
  ngo_id uuid references public.ngos(id) on delete restrict,
  assigned_caseworker_id uuid references public.profiles(id) on delete restrict,
  status text not null check (status in ('in_care', 'foster_care', 'adoption_process', 'left_care', 'closed')),
  cwc_order_number text,
  referral_summary text,
  referral_summary_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint children_referral_summary_timestamps check ((referral_summary is null and referral_summary_updated_at is null) or (referral_summary is not null and referral_summary_updated_at is not null))
);

create table public.child_private (
  child_id uuid primary key references public.children(id) on delete restrict,
  legal_name text not null,
  date_of_birth date not null,
  background text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.parent_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'verified', 'in_person_check', 'home_study', 'referred', 'reserved', 'pre_adoption_care', 'order_issued', 'follow_up', 'closed')),
  preferred_religion text,
  preferred_age_min smallint check (preferred_age_min is null or preferred_age_min >= 0),
  preferred_age_max smallint check (preferred_age_max is null or preferred_age_max >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_age_preference_order check (preferred_age_min is null or preferred_age_max is null or preferred_age_min <= preferred_age_max)
);

create table public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.profiles(id) on delete restrict,
  child_id uuid references public.children(id) on delete restrict,
  parent_application_id uuid references public.parent_applications(id) on delete restrict,
  complaint_id uuid,
  assignment_type text not null check (assignment_type in ('caseworker', 'verification', 'protection', 'on_call')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_assignment_target_check check (num_nonnulls(child_id, parent_application_id, complaint_id) = 1),
  constraint staff_assignment_type_role_check check (assignment_type in ('caseworker', 'verification', 'protection', 'on_call'))
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id) on delete restrict,
  child_id uuid references public.children(id) on delete restrict,
  ngo_id uuid references public.ngos(id) on delete restrict,
  document_type text not null check (document_type in ('education', 'care_record', 'recognition', 'compliance', 'funding_support', 'other')),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size_bytes integer not null check (file_size_bytes between 1 and 10485760),
  verified_by uuid references public.profiles(id) on delete restrict,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_owner_check check (num_nonnulls(owner_user_id, child_id, ngo_id) = 1)
);

create table public.parent_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.parent_applications(id) on delete restrict,
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  document_type text not null check (document_type in ('identity', 'address', 'income', 'medical', 'police_verification', 'adoption_order', 'official_photo', 'other')),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size_bytes integer not null check (file_size_bytes between 1 and 10485760),
  verification_status text not null default 'submitted' check (verification_status in ('submitted', 'verified', 'rejected')),
  verified_by uuid references public.profiles(id) on delete restrict,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_documents_verification_check check ((verification_status = 'verified' and verified_by is not null and verified_at is not null) or verification_status <> 'verified')
);

create table public.adoption_tracker (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.parent_applications(id) on delete restrict,
  step text not null check (step in ('documents_submitted', 'documents_verified', 'in_person_check', 'carings_registered', 'home_study_done', 'child_referred', 'child_reserved', 'pre_adoption_foster_care', 'adoption_order_issued', 'post_adoption_follow_up')),
  step_date date not null default current_date,
  carings_registration_number text,
  referral_reference text,
  adoption_order_number text,
  adoption_order_date date,
  entered_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adoption_order_fields_check check ((adoption_order_number is null and adoption_order_date is null) or (adoption_order_number is not null and adoption_order_date is not null))
);

create table public.parent_child_referrals (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.parent_applications(id) on delete restrict,
  child_id uuid not null references public.children(id) on delete restrict,
  referral_reference text not null,
  referred_at timestamptz not null default now(),
  entered_by uuid not null references public.profiles(id) on delete restrict,
  unique (application_id, child_id)
);

create table public.foster_interests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  state text not null,
  status text not null default 'pending' check (status in ('pending', 'contacted', 'forwarded', 'closed')),
  forwarded_to_dcpu boolean not null default false,
  cwc_decision text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete restrict,
  reporter_user_id uuid not null references public.profiles(id) on delete restrict,
  category text not null check (category in ('abuse', 'harassment', 'neglect', 'food_health', 'education', 'other')),
  urgency text not null check (urgency in ('emergency', 'serious', 'normal')),
  details text not null check (length(trim(details)) between 1 and 5000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'action_taken', 'closed')),
  assigned_protection_officer uuid references public.profiles(id) on delete restrict,
  due_at timestamptz,
  outcome_contacted text check (outcome_contacted is null or outcome_contacted in ('police_unit', 'childline_1098', 'cwc', 'other')),
  outcome_contacted_at timestamptz,
  outcome_method text check (outcome_method is null or outcome_method in ('phone', 'in_person', 'email', 'other')),
  outcome_notes text,
  outcome_recorded_by uuid references public.profiles(id) on delete restrict,
  child_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emergency_deadline_check check (urgency <> 'emergency' or due_at is not null),
  constraint complaint_outcome_fields_check check ((outcome_contacted is null and outcome_contacted_at is null and outcome_method is null and outcome_recorded_by is null) or (outcome_contacted is not null and outcome_contacted_at is not null and outcome_method is not null and outcome_recorded_by is not null))
);

alter table public.staff_assignments
  add constraint staff_assignments_complaint_id_fkey foreign key (complaint_id) references public.complaints(id) on delete restrict;

create table public.complaint_events (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete restrict,
  event_type text not null check (event_type in ('status_changed', 'officer_contacted', 'deadline_flagged', 'outcome_recorded', 'note_added')),
  event_summary text not null check (length(event_summary) <= 500),
  is_child_visible boolean not null default false,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete restrict,
  requester_user_id uuid not null references public.profiles(id) on delete restrict,
  topic text not null check (topic in ('foster_care', 'other_support')),
  details text not null default '' check (length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_grievances (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete restrict,
  is_anonymous boolean not null default false,
  category text not null check (category in ('corruption', 'harassment', 'inconvenience')),
  person_named text,
  details text not null check (length(trim(details)) between 1 and 4000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anonymous_grievance_identity_check check ((is_anonymous and created_by is null) or (not is_anonymous and created_by is not null))
);

create table public.funding_requests (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngos(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  amount_paise bigint not null check (amount_paise between 1 and 100000000),
  purpose text not null check (length(trim(purpose)) between 1 and 1000),
  support_document_id uuid not null references public.documents(id) on delete restrict,
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'approved', 'rejected', 'paid')),
  approver_one_id uuid references public.profiles(id) on delete restrict,
  approver_one_at timestamptz,
  approver_two_id uuid references public.profiles(id) on delete restrict,
  approver_two_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funding_two_distinct_approvers check (approver_one_id is null or approver_two_id is null or approver_one_id <> approver_two_id),
  constraint funding_approval_fields_check check ((approver_one_id is null and approver_one_at is null) or (approver_one_id is not null and approver_one_at is not null)),
  constraint funding_approval_two_fields_check check ((approver_two_id is null and approver_two_at is null) or (approver_two_id is not null and approver_two_at is not null))
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete restrict,
  entity_table text not null,
  entity_id uuid,
  action text not null check (action in ('view', 'create', 'update', 'delete', 'child_account_created', 'document_download', 'complaint_list')),
  created_at timestamptz not null default now()
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete restrict,
  actor_user_id uuid references public.profiles(id) on delete restrict,
  foster_interest_id uuid references public.foster_interests(id) on delete restrict,
  consent_type text not null check (consent_type in ('parent_signup', 'document_upload', 'ngo_onboarding', 'child_onboarding_guardian', 'child_complaint', 'adult_after_care_first_login', 'staff_code_conduct', 'foster_interest')),
  document_version text not null check (length(trim(document_version)) between 1 and 80),
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint consent_subject_check check (user_id is not null or foster_interest_id is not null)
);

create table public.public_submission_limits (
  request_hash text primary key check (request_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count >= 0),
  updated_at timestamptz not null default now()
);

create table public.child_login_limits (
  request_hash text primary key check (request_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count >= 0),
  updated_at timestamptz not null default now()
);

create index profiles_role_subrole_idx on public.profiles(role, sub_role);
create index profiles_ngo_id_idx on public.profiles(ngo_id) where ngo_id is not null;
create index ngos_status_idx on public.ngos(verification_status, recognition_type);
create index ngos_renewal_idx on public.ngos(renewal_date) where renewal_date is not null;
create index children_ngo_status_idx on public.children(ngo_id, status) where ngo_id is not null;
create index children_assigned_caseworker_idx on public.children(assigned_caseworker_id, status);
create index children_user_idx on public.children(user_id) where user_id is not null;
create index documents_child_idx on public.documents(child_id, created_at desc) where child_id is not null;
create index documents_owner_idx on public.documents(owner_user_id, created_at desc) where owner_user_id is not null;
create index parent_documents_application_idx on public.parent_documents(application_id, created_at desc);
create index adoption_tracker_application_idx on public.adoption_tracker(application_id, step_date);
create index parent_referrals_child_idx on public.parent_child_referrals(child_id, application_id);
create index foster_interests_status_idx on public.foster_interests(status, created_at desc);
create index complaints_assigned_urgency_idx on public.complaints(assigned_protection_officer, urgency, created_at desc);
create index complaints_due_idx on public.complaints(due_at) where urgency = 'emergency' and status <> 'closed';
create index complaints_child_idx on public.complaints(child_id, created_at desc);
create index complaint_events_case_idx on public.complaint_events(complaint_id, created_at);
create index support_requests_child_idx on public.support_requests(child_id, created_at desc);
create index staff_grievances_status_idx on public.staff_grievances(status, created_at desc);
create index funding_requests_ngo_status_idx on public.funding_requests(ngo_id, status, created_at desc);
create index audit_log_entity_idx on public.audit_log(entity_table, entity_id, created_at desc);
create index audit_log_actor_idx on public.audit_log(actor_id, created_at desc);
create index consents_user_idx on public.consents(user_id, consented_at desc) where user_id is not null;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger ngos_updated_at before update on public.ngos for each row execute function public.set_updated_at();
create trigger children_updated_at before update on public.children for each row execute function public.set_updated_at();
create trigger child_private_updated_at before update on public.child_private for each row execute function public.set_updated_at();
create trigger parent_applications_updated_at before update on public.parent_applications for each row execute function public.set_updated_at();
create trigger staff_assignments_updated_at before update on public.staff_assignments for each row execute function public.set_updated_at();
create trigger documents_updated_at before update on public.documents for each row execute function public.set_updated_at();
create trigger parent_documents_updated_at before update on public.parent_documents for each row execute function public.set_updated_at();
create trigger adoption_tracker_updated_at before update on public.adoption_tracker for each row execute function public.set_updated_at();
create trigger foster_interests_updated_at before update on public.foster_interests for each row execute function public.set_updated_at();
create trigger complaints_updated_at before update on public.complaints for each row execute function public.set_updated_at();
create trigger support_requests_updated_at before update on public.support_requests for each row execute function public.set_updated_at();
create trigger staff_grievances_updated_at before update on public.staff_grievances for each row execute function public.set_updated_at();
create trigger funding_requests_updated_at before update on public.funding_requests for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  assigned_role text;
  assigned_sub_role text;
begin
  assigned_role := coalesce(new.raw_app_meta_data ->> 'role', 'parent');
  assigned_sub_role := new.raw_app_meta_data ->> 'sub_role';
  if assigned_role not in ('child', 'adult_after_care', 'parent', 'ngo', 'staff') then
    assigned_role := 'parent';
    assigned_sub_role := null;
  end if;
  if assigned_role <> 'staff' then assigned_sub_role := null; end if;
  if assigned_role = 'staff' and assigned_sub_role not in ('verification_team', 'caseworker', 'protection_officer', 'grievance_committee', 'admin') then
    raise exception 'Staff profile requires an approved sub-role.';
  end if;
  insert into public.profiles (id, role, sub_role, language)
  values (new.id, assigned_role, assigned_sub_role, 'en')
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

commit;
