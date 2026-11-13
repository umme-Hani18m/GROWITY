begin;

-- Delete demo complaint events first.
delete from public.complaint_events where is_demo;
-- Delete demo complaints next.
delete from public.complaints where is_demo;
-- Delete demo support requests.
delete from public.support_requests where is_demo;
-- Delete demo parent-child referrals.
delete from public.parent_child_referrals where is_demo;
-- Delete demo tracker rows.
delete from public.adoption_tracker where is_demo;
-- Delete demo parent documents.
delete from public.parent_documents where is_demo;
-- Delete demo funding requests.
delete from public.funding_requests where is_demo;
-- Delete demo documents.
delete from public.documents where is_demo;
-- Delete demo child-private rows.
delete from public.child_private where is_demo;
-- Delete demo staff assignments.
delete from public.staff_assignments where is_demo;
-- Delete demo children.
delete from public.children where is_demo;
-- Delete demo foster interests.
delete from public.foster_interests where is_demo;
-- Delete demo child onboarding requests.
delete from public.child_onboarding_requests where is_demo;
-- Delete demo adult identity requests.
delete from public.adult_identity_requests where is_demo;
-- Delete demo consents.
delete from public.consents where is_demo;
-- Delete demo audit records.
delete from public.audit_log where is_demo;
-- Delete demo anonymous grievances.
delete from public.staff_grievances where is_demo;
-- Delete demo NGOs last.
delete from public.ngos where is_demo;

commit;
