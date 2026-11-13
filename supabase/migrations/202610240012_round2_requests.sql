begin;

create table if not exists public.child_onboarding_requests (
  id uuid primary key default gen_random_uuid(),
  preferred_name text not null check (length(trim(preferred_name)) between 1 and 80),
  age_range text not null check (age_range in ('under_13', '13_to_17')),
  state text not null check (length(trim(state)) between 2 and 120),
  safe_contact text check (safe_contact is null or length(trim(safe_contact)) <= 254),
  guardian_or_caseworker_known boolean not null default false,
  consented_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'in_review', 'completed', 'closed')),
  assigned_caseworker_id uuid references public.profiles(id) on delete restrict,
  completed_child_id uuid references public.children(id) on delete restrict,
  completed_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint child_onboarding_completion_check check ((status = 'completed' and completed_child_id is not null and completed_at is not null) or status <> 'completed')
);

create table if not exists public.adult_identity_requests (
  id uuid primary key default gen_random_uuid(),
  pathway text not null check (pathway in ('in_care_18_plus', 'adopted_18_plus')),
  email text not null check (email = lower(email) and length(email) <= 254),
  full_name text not null check (length(trim(full_name)) between 2 and 160),
  date_of_birth date not null,
  care_organisation text check (care_organisation is null or length(trim(care_organisation)) <= 180),
  milestone_year smallint not null check (milestone_year between 1900 and 2100),
  consented_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'in_review', 'verified', 'rejected', 'closed')),
  verified_by uuid references public.profiles(id) on delete restrict,
  verified_at timestamptz,
  auth_user_id uuid references auth.users(id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adult_identity_verification_check check ((status = 'verified' and verified_by is not null and verified_at is not null) or status <> 'verified')
);

create index if not exists child_onboarding_requests_status_idx on public.child_onboarding_requests(status, created_at desc);
create index if not exists adult_identity_requests_email_status_idx on public.adult_identity_requests(email, status, created_at desc);

create or replace trigger child_onboarding_requests_updated_at
before update on public.child_onboarding_requests
for each row execute function public.set_updated_at();

create or replace trigger adult_identity_requests_updated_at
before update on public.adult_identity_requests
for each row execute function public.set_updated_at();

alter table public.child_onboarding_requests enable row level security;
alter table public.adult_identity_requests enable row level security;

revoke all on table public.child_onboarding_requests from public, anon;
revoke all on table public.adult_identity_requests from public, anon;
grant select, update on table public.child_onboarding_requests to authenticated;
grant select, update on table public.adult_identity_requests to authenticated;

drop policy if exists child_onboarding_requests_staff_select on public.child_onboarding_requests;
drop policy if exists child_onboarding_requests_staff_update on public.child_onboarding_requests;
drop policy if exists adult_identity_requests_staff_select on public.adult_identity_requests;
drop policy if exists adult_identity_requests_staff_update on public.adult_identity_requests;

create policy child_onboarding_requests_staff_select on public.child_onboarding_requests
for select using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('caseworker', 'admin')
  and (select app_private.staff_mfa_verified())
);

create policy child_onboarding_requests_staff_update on public.child_onboarding_requests
for update using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('caseworker', 'admin')
  and (select app_private.staff_mfa_verified())
) with check (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('caseworker', 'admin')
  and (select app_private.staff_mfa_verified())
);

create policy adult_identity_requests_staff_select on public.adult_identity_requests
for select using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('caseworker', 'verification_team', 'admin')
  and (select app_private.staff_mfa_verified())
);

create policy adult_identity_requests_staff_update on public.adult_identity_requests
for update using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('caseworker', 'verification_team', 'admin')
  and (select app_private.staff_mfa_verified())
) with check (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) in ('caseworker', 'verification_team', 'admin')
  and (select app_private.staff_mfa_verified())
);

commit;
