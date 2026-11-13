begin;

-- Mark NGO rows that exist only for local or test demonstrations.
alter table public.ngos add column if not exists is_demo boolean not null default false;
-- Mark child rows that exist only for local or test demonstrations.
alter table public.children add column if not exists is_demo boolean not null default false;
-- Mark child-private rows that exist only for local or test demonstrations.
alter table public.child_private add column if not exists is_demo boolean not null default false;
-- Mark parent application rows that exist only for local or test demonstrations.
alter table public.parent_applications add column if not exists is_demo boolean not null default false;
-- Mark tracker rows that exist only for local or test demonstrations.
alter table public.adoption_tracker add column if not exists is_demo boolean not null default false;
-- Mark referral rows that exist only for local or test demonstrations.
alter table public.parent_child_referrals add column if not exists is_demo boolean not null default false;
-- Mark child and NGO document rows that exist only for local or test demonstrations.
alter table public.documents add column if not exists is_demo boolean not null default false;
-- Mark parent document rows that exist only for local or test demonstrations.
alter table public.parent_documents add column if not exists is_demo boolean not null default false;
-- Mark foster interest rows that exist only for local or test demonstrations.
alter table public.foster_interests add column if not exists is_demo boolean not null default false;
-- Mark complaint rows that exist only for local or test demonstrations.
alter table public.complaints add column if not exists is_demo boolean not null default false;
-- Mark complaint event rows that exist only for local or test demonstrations.
alter table public.complaint_events add column if not exists is_demo boolean not null default false;
-- Mark support request rows that exist only for local or test demonstrations.
alter table public.support_requests add column if not exists is_demo boolean not null default false;
-- Mark staff grievance rows that exist only for local or test demonstrations.
alter table public.staff_grievances add column if not exists is_demo boolean not null default false;
-- Mark funding request rows that exist only for local or test demonstrations.
alter table public.funding_requests add column if not exists is_demo boolean not null default false;
-- Mark assignment rows that exist only for local or test demonstrations.
alter table public.staff_assignments add column if not exists is_demo boolean not null default false;
-- Mark audit rows that exist only for local or test demonstrations.
alter table public.audit_log add column if not exists is_demo boolean not null default false;
-- Mark consent rows that exist only for local or test demonstrations.
alter table public.consents add column if not exists is_demo boolean not null default false;
-- Mark onboarding request rows that exist only for local or test demonstrations.
alter table public.child_onboarding_requests add column if not exists is_demo boolean not null default false;
-- Mark adult identity request rows that exist only for local or test demonstrations.
alter table public.adult_identity_requests add column if not exists is_demo boolean not null default false;

commit;
