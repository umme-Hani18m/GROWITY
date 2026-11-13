-- Read-only verification for the Growity migration set.
-- Run after 202610240013_demo_flags.sql. It does not write application data.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles', 'children', 'child_private', 'parent_applications',
    'ngos', 'staff_assignments', 'documents', 'parent_documents',
    'adoption_tracker', 'foster_interests', 'complaints', 'support_requests',
    'staff_grievances', 'funding_requests', 'audit_log', 'consents',
    'child_onboarding_requests', 'adult_identity_requests'
  )
order by table_name;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles', 'children', 'child_private', 'parent_applications',
    'ngos', 'staff_assignments', 'documents', 'parent_documents',
    'adoption_tracker', 'foster_interests', 'complaints', 'support_requests',
    'staff_grievances', 'funding_requests', 'audit_log', 'consents',
    'child_onboarding_requests', 'adult_identity_requests'
  )
order by tablename;

select id, name, public
from storage.buckets
where id = 'private-documents';

select n.nspname as schema_name, p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname, p.proname) in (
  ('public', 'handle_new_auth_user'),
  ('public', 'consume_public_submission_attempt'),
  ('public', 'consume_child_login_attempt'),
  ('public', 'log_audit_event'),
  ('app_private', 'current_role'),
  ('app_private', 'staff_mfa_verified')
)
order by schema_name, function_name;
