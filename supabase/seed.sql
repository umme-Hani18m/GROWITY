begin;

-- Remove prior demo complaint events before replacing demo complaints.
delete from public.complaint_events where is_demo;
-- Remove prior demo complaints before replacing demo children.
delete from public.complaints where is_demo;
-- Remove prior demo support requests before replacing demo children.
delete from public.support_requests where is_demo;
-- Remove prior demo referrals before replacing demo parent applications.
delete from public.parent_child_referrals where is_demo;
-- Remove prior demo tracker rows before replacing demo parent applications.
delete from public.adoption_tracker where is_demo;
-- Remove prior demo parent documents before replacing demo parent applications.
delete from public.parent_documents where is_demo;
-- Remove prior demo funding requests before replacing demo NGO documents.
delete from public.funding_requests where is_demo;
-- Remove prior demo documents before replacing demo children and NGOs.
delete from public.documents where is_demo;
-- Remove prior demo child-private rows before replacing demo children.
delete from public.child_private where is_demo;
-- Remove prior demo staff assignments before replacing demo children.
delete from public.staff_assignments where is_demo;
-- Remove prior demo child rows before replacing demo children.
delete from public.children where is_demo;
-- Remove prior demo foster interests before replacing demo foster workflow.
delete from public.foster_interests where is_demo;
-- Remove prior demo child onboarding requests before replacing demo request queue.
delete from public.child_onboarding_requests where is_demo;
-- Remove prior demo adult identity requests before replacing demo verification queue.
delete from public.adult_identity_requests where is_demo;
-- Remove prior demo consent rows before replacing demo users' consent examples.
delete from public.consents where is_demo;
-- Remove prior demo audit rows before replacing demo audit examples.
delete from public.audit_log where is_demo;
-- Remove prior demo anonymous grievance rows before replacing demo grievance examples.
delete from public.staff_grievances where is_demo;
-- Remove prior demo NGO rows before replacing demo organisations.
delete from public.ngos where is_demo;

-- Insert the first fake NGO as a verified Specialised Adoption Agency when a demo verifier exists.
do $$ declare verifier uuid; begin select id into verifier from public.profiles where full_name = 'DEMO VERIFIER' limit 1; if verifier is not null then insert into public.ngos (id,display_name,recognition_type,registration_number,recognition_number,recognition_date,state,verification_status,verified_by,verified_at,renewal_date,is_demo) values ('00000000-0000-4000-8000-000000001001','DEMO NGO ONE','saa','DEMO-SAA-001','DEMO-RECOGNITION-001',date '2024-01-15','TEST STATE','verified',verifier,now()+interval '1 day',date '2027-01-15',true); else insert into public.ngos (id,display_name,recognition_type,registration_number,recognition_number,recognition_date,state,verification_status,renewal_date,is_demo) values ('00000000-0000-4000-8000-000000001001','DEMO NGO ONE','saa','DEMO-SAA-001','DEMO-RECOGNITION-001',date '2024-01-15','TEST STATE','pending',date '2027-01-15',true); end if; end $$;
-- Insert the second fake NGO as a verified Child Care Institution when a demo verifier exists.
do $$ declare verifier uuid; begin select id into verifier from public.profiles where full_name = 'DEMO VERIFIER' limit 1; if verifier is not null then insert into public.ngos (id,display_name,recognition_type,registration_number,recognition_number,recognition_date,state,verification_status,verified_by,verified_at,renewal_date,is_demo) values ('00000000-0000-4000-8000-000000001002','DEMO NGO TWO','cci','DEMO-CCI-002','DEMO-RECOGNITION-002',date '2023-06-10','TEST STATE','verified',verifier,now()+interval '1 day',date '2026-06-10',true); else insert into public.ngos (id,display_name,recognition_type,registration_number,recognition_number,recognition_date,state,verification_status,renewal_date,is_demo) values ('00000000-0000-4000-8000-000000001002','DEMO NGO TWO','cci','DEMO-CCI-002','DEMO-RECOGNITION-002',date '2023-06-10','TEST STATE','pending',date '2026-06-10',true); end if; end $$;
-- Insert the third fake NGO as pending.
insert into public.ngos (id,display_name,recognition_type,registration_number,recognition_number,recognition_date,state,verification_status,renewal_date,is_demo) values ('00000000-0000-4000-8000-000000001003','DEMO NGO THREE','cci','DEMO-CCI-003','DEMO-PENDING-003',date '2025-02-20','TEST STATE','pending',date '2028-02-20',true);

-- Insert eight fake children with CWC-TEST-000x references.
insert into public.children (id,public_code,ngo_id,status,cwc_order_number,is_demo) values
('00000000-0000-4000-8000-000000002001','C-1001','00000000-0000-4000-8000-000000001001','in_care','CWC-TEST-0001',true),
('00000000-0000-4000-8000-000000002002','C-1002','00000000-0000-4000-8000-000000001001','foster_care','CWC-TEST-0002',true),
('00000000-0000-4000-8000-000000002003','C-1003','00000000-0000-4000-8000-000000001002','adoption_process','CWC-TEST-0003',true),
('00000000-0000-4000-8000-000000002004','C-1004','00000000-0000-4000-8000-000000001002','in_care','CWC-TEST-0004',true),
('00000000-0000-4000-8000-000000002005','C-1005','00000000-0000-4000-8000-000000001003','foster_care','CWC-TEST-0005',true),
('00000000-0000-4000-8000-000000002006','C-1006','00000000-0000-4000-8000-000000001001','left_care','CWC-TEST-0006',true),
('00000000-0000-4000-8000-000000002007','C-1007','00000000-0000-4000-8000-000000001002','closed','CWC-TEST-0007',true),
('00000000-0000-4000-8000-000000002008','C-1008','00000000-0000-4000-8000-000000001003','in_care','CWC-TEST-0008',true);

-- Insert fake child-private identities without photos or real documents.
insert into public.child_private (child_id,legal_name,date_of_birth,background,is_demo) values
('00000000-0000-4000-8000-000000002001','DEMO CHILD ONE',date '2013-04-01','TEST ONLY',true),
('00000000-0000-4000-8000-000000002002','DEMO CHILD TWO',date '2012-06-12','TEST ONLY',true),
('00000000-0000-4000-8000-000000002003','DEMO CHILD THREE',date '2011-08-23','TEST ONLY',true),
('00000000-0000-4000-8000-000000002004','DEMO CHILD FOUR',date '2014-02-17','TEST ONLY',true),
('00000000-0000-4000-8000-000000002005','DEMO CHILD FIVE',date '2010-10-05','TEST ONLY',true),
('00000000-0000-4000-8000-000000002006','DEMO CHILD SIX',date '2008-12-19','TEST ONLY',true),
('00000000-0000-4000-8000-000000002007','DEMO CHILD SEVEN',date '2007-03-08','TEST ONLY',true),
('00000000-0000-4000-8000-000000002008','DEMO CHILD EIGHT',date '2015-09-28','TEST ONLY',true);

-- Insert two fake foster interests, one new and one forwarded with a CWC decision.
insert into public.foster_interests (id,name,contact,state,status,forwarded_to_dcpu,cwc_decision,is_demo) values
('00000000-0000-4000-8000-000000003001','DEMO FOSTER PERSON ONE','0000000000','TEST STATE','pending',false,null,true),
('00000000-0000-4000-8000-000000003002','DEMO FOSTER PERSON TWO','0000000000','TEST STATE','forwarded',true,'CWC TEST APPROVED',true);

-- Insert one anonymous fake staff grievance.
insert into public.staff_grievances (id,created_by,is_anonymous,category,person_named,details,status,is_demo) values ('00000000-0000-4000-8000-000000003101',null,true,'inconvenience',null,'TEST ONLY — anonymous staff grievance for workflow review.','open',true);

-- Insert child complaints and visible events only when a demo child profile exists for the reporter foreign key.
do $$ declare reporter uuid; begin select id into reporter from public.profiles where role = 'child' limit 1; if reporter is not null then insert into public.complaints (id,child_id,reporter_user_id,category,urgency,details,status,due_at,is_demo) values ('00000000-0000-4000-8000-000000004001','00000000-0000-4000-8000-000000002001',reporter,'abuse','emergency','TEST ONLY — emergency complaint with a past deadline.','open',now()-interval '1 day',true),('00000000-0000-4000-8000-000000004002','00000000-0000-4000-8000-000000002002',reporter,'neglect','serious','TEST ONLY — serious complaint.','reviewing',now()+interval '1 day',true),('00000000-0000-4000-8000-000000004003','00000000-0000-4000-8000-000000002003',reporter,'education','normal','TEST ONLY — normal complaint.','open',now()+interval '1 day',true); insert into public.complaint_events (complaint_id,event_type,event_summary,is_child_visible,actor_user_id,is_demo) values ('00000000-0000-4000-8000-000000004001','deadline_flagged','TEST ONLY — emergency deadline passed.',true,reporter,true),('00000000-0000-4000-8000-000000004002','status_changed','TEST ONLY — complaint moved to review.',true,reporter,true),('00000000-0000-4000-8000-000000004003','note_added','TEST ONLY — complaint received.',true,reporter,true); end if; end $$;

-- Insert four parent family applications when matching fake parent profiles already exist.
insert into public.parent_applications (id,user_id,status,is_demo) select '00000000-0000-4000-8000-000000005001',id,'submitted',true from public.profiles where full_name = 'DEMO PARENT ONE' limit 1;
-- Insert the second parent family at the documents-verified step.
insert into public.parent_applications (id,user_id,status,is_demo) select '00000000-0000-4000-8000-000000005002',id,'verified',true from public.profiles where full_name = 'DEMO PARENT TWO' limit 1;
-- Insert the third parent family at the CARINGS registration step.
insert into public.parent_applications (id,user_id,status,is_demo) select '00000000-0000-4000-8000-000000005003',id,'referred',true from public.profiles where full_name = 'DEMO PARENT THREE' limit 1;
-- Insert the fourth parent family at the adoption-order and follow-up step.
insert into public.parent_applications (id,user_id,status,is_demo) select '00000000-0000-4000-8000-000000005004',id,'follow_up',true from public.profiles where full_name = 'DEMO PARENT FOUR' limit 1;

-- Insert tracker history for the four fake parent families when their applications exist.
insert into public.adoption_tracker (application_id,step,step_date,entered_by,is_demo) select '00000000-0000-4000-8000-000000005001','documents_submitted',date '2026-01-15',id,true from public.profiles where full_name = 'DEMO ADMIN' limit 1;
-- Insert the second family's tracker step.
insert into public.adoption_tracker (application_id,step,step_date,entered_by,is_demo) select '00000000-0000-4000-8000-000000005002','documents_verified',date '2026-02-15',id,true from public.profiles where full_name = 'DEMO ADMIN' limit 1;
-- Insert the third family's CARINGS tracker step.
insert into public.adoption_tracker (application_id,step,step_date,carings_registration_number,entered_by,is_demo) select '00000000-0000-4000-8000-000000005003','carings_registered',date '2026-03-15','TEST-CARINGS-001',id,true from public.profiles where full_name = 'DEMO ADMIN' limit 1;
-- Insert the fourth family's adoption order and follow-up reminder.
insert into public.adoption_tracker (application_id,step,step_date,adoption_order_number,adoption_order_date,entered_by,is_demo) select '00000000-0000-4000-8000-000000005004','adoption_order_issued',date '2026-04-15','TEST-DM-001',date '2026-04-15',id,true from public.profiles where full_name = 'DEMO ADMIN' limit 1;
-- Insert the fourth family's follow-up reminder.
insert into public.adoption_tracker (application_id,step,step_date,entered_by,is_demo) select '00000000-0000-4000-8000-000000005004','post_adoption_follow_up',date '2026-10-15',id,true from public.profiles where full_name = 'DEMO ADMIN' limit 1;

-- Insert two fake child/NGO documents when demo profiles exist.
do $$ declare ngo_user uuid; begin select id into ngo_user from public.profiles where full_name = 'DEMO NGO ONE' limit 1; if ngo_user is not null then insert into public.documents (id,owner_user_id,ngo_id,document_type,storage_path,mime_type,file_size_bytes,uploaded_by,is_demo) values ('00000000-0000-4000-8000-000000006001',ngo_user,'00000000-0000-4000-8000-000000001001','recognition','demo/ngo-one/recognition.pdf','application/pdf',1024,ngo_user,true),('00000000-0000-4000-8000-000000006002',null,'00000000-0000-4000-8000-000000001001','compliance','demo/ngo-one/compliance.pdf','application/pdf',2048,ngo_user,true); end if; end $$;

-- Insert two funding requests only when the demo NGO profile and supporting documents exist.
do $$ declare ngo_user uuid; doc_id uuid; begin select id into ngo_user from public.profiles where full_name = 'DEMO NGO ONE' limit 1; select id into doc_id from public.documents where id = '00000000-0000-4000-8000-000000006001' and is_demo; if ngo_user is not null and doc_id is not null then insert into public.funding_requests (id,ngo_id,created_by,amount_paise,purpose,support_document_id,status,is_demo) values ('00000000-0000-4000-8000-000000007001','00000000-0000-4000-8000-000000001001',ngo_user,2500000,'TEST ONLY — first approval pending.',doc_id,'under_review',true),('00000000-0000-4000-8000-000000007002','00000000-0000-4000-8000-000000001001',ngo_user,4000000,'TEST ONLY — second approval pending.',doc_id,'under_review',true); end if; end $$;

commit;
