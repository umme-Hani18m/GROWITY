# Growity Supabase migration runbook

This folder contains the complete Growity PostgreSQL, Auth-trigger, RLS, audit, and private Storage setup. The migrations are ordered by filename and must be run in that order.

## Migration order

1. `migrations/202610240001_core_schema.sql` — creates the `app_private` schema, core tables, constraints, timestamps, Auth profile trigger, indexes, and initial grants.
2. `migrations/202610240002_rls_and_storage.sql` — creates the supporting workflow tables, security helper functions, rate-limit RPCs, role/ownership RLS policies, audit triggers, public-safe NGO views, and the private `private-documents` Storage bucket/policies.
3. `migrations/202610240003_workflow_hardening.sql` — adds assignments and hardens upload, consent, rights-request, foster-interest, staff-role, and emergency-routing behavior.
4. `migrations/202610240004_audit_workflows.sql` — installs/strengthens append-only audit workflow functions and grants.
5. `migrations/202610240005_adult_and_archive_access.sql` — adds restricted adult-after-care and archived-document access rules.
6. `migrations/202610240006_role_consent_policies.sql` — replaces the earlier consent-insert policy with the stricter role-aware policy.
7. `migrations/202610240007_staff_workflows.sql` — adds case meetings, compatibility notes, complaint events, and staff workflow protections.
8. `migrations/202610240008_adoption_tracker_rpc.sql` — adds the guarded adoption-tracker transition RPC.
9. `migrations/202610240009_admin_funding_document_access.sql` — adds narrowly scoped funding-support document access.
10. `migrations/202610240010_aftercare_owner_reads.sql` — adds self-only adult-after-care consent and data-rights reads.
11. `migrations/202610240011_grievance_reviewer_and_self_role_guard.sql` — adds grievance reviewer rules, role guards, and staff grievance RPCs.
12. `migrations/202610240012_round2_requests.sql` — adds child onboarding and adult identity-verification request tables and MFA-gated staff policies.
13. `migrations/202610240013_demo_flags.sql` — adds `is_demo` flags only; it does not create demo rows.

Do **not** run `demo/02_full_fake_seed.sql`, `seed.sql`, or `demo/99_cleanup_demo.sql` against the Growity production project. They are for a disposable development project only.

## Safety properties

- No migration drops a table, truncates a table, deletes ordinary application records, or resets the database.
- The `DROP POLICY IF EXISTS` statements remove only named policies immediately before replacing them with stricter definitions; they do not delete rows.
- `CREATE OR REPLACE FUNCTION` and `CREATE OR REPLACE VIEW` replace database code/views, not application records. Review the migration files in version order before execution.
- Demo cleanup SQL is intentionally excluded from the production runbook because it deletes rows marked `is_demo`.
- Run the migrations once, in order, as one SQL Editor query per file. If a query fails, stop and record the error; do not skip ahead or repeatedly rerun an unknown partial migration.

## Supabase SQL Editor steps

1. Open the confirmed Growity project in Supabase Dashboard and choose **SQL Editor → New query**.
2. Open `202610240001_core_schema.sql` from this repository, copy the complete file, paste it into the editor, and click **Run**.
3. Confirm the query succeeds. Repeat for files `202610240002` through `202610240013`, strictly in filename order.
4. After the final migration, open **Table Editor** and confirm that `profiles`, `children`, `child_private`, `parent_applications`, `ngos`, `staff_assignments`, `documents`, `parent_documents`, `adoption_tracker`, `foster_interests`, `complaints`, `support_requests`, `staff_grievances`, `funding_requests`, `audit_log`, `consents`, `child_onboarding_requests`, and `adult_identity_requests` exist.
5. Open **Storage** and confirm `private-documents` exists and is **not public**.
6. In the SQL Editor, run the read-only verification below:

```sql
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
```

The first query should list all 18 named tables, the second should show `rowsecurity = true` for every listed table, and the final query should show `public = false`.

## Required Auth configuration after migrations

The SQL schema does not configure Supabase Auth SMTP or dashboard-level email settings. In **Authentication → Providers → Email**:

- Enable email provider and email signups.
- Enable passwordless/email OTP behavior used by the application.
- Configure a verified custom SMTP sender for non-team addresses.
- In the email template, display the numeric `{{ .Token }}` value because Growity verifies a six-digit code rather than a magic-link click.
- In **Authentication → URL Configuration**, add the exact Preview and production origins and redirect paths used by the application.
- Keep staff MFA enabled and require TOTP enrollment before staff workspace access.

The application will continue to fail closed if Supabase, Turnstile, rate-limit, or PIN secrets are missing. A successful Auth API response confirms request acceptance; it does not prove that an email reached an inbox.
