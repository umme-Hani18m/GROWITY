# Growity access-control checklist

Run only against a disposable, isolated Supabase test project populated with fake identities and fake files. Never run destructive or role-manipulation tests against production. **Status for every case: NOT RUN** until an operator records a result in the isolated test environment. A passing typecheck or static policy inspection is not a substitute for these authorization tests.

## Authentication and role boundaries

1. **Unauthenticated staff access:** opening the Team workspace or calling a staff server action shows no private records and performs no state change.
2. **Staff without AAL2/MFA:** an authenticated staff account below the required MFA assurance level cannot load a dashboard, query staff queues, download a document, or invoke a staff action.
3. **Staff without the required agreement:** a staff account that has not accepted the current Staff Code of Conduct cannot enter the workspace or submit a grievance.
4. **Wrong staff sub-role:** verification staff cannot run caseworker/protection/grievance/admin actions; protection officers cannot manage parent applications; caseworkers cannot access the grievance committee queue; admin cannot call complaint or grievance read operations.
5. **Non-staff role escalation:** a child, parent, or NGO profile cannot obtain a staff role by editing a request body, form field, URL, or editable profile value.
6. **Role change safety:** an admin cannot change their own sub-role through the role-management form OR a direct authenticated Supabase UPDATE; only an authorised admin action can change another staff member's assignment.

## Child and adult-after-care boundaries

7. **Child A vs. Child B row access:** Child A cannot select Child B's `children`, `child_private`, support requests, complaint records, or documents by UUID or public code.
8. **Child A vs. Child B download:** Child A cannot request or use a signed URL for Child B's document, including by changing a document ID in a form or request.
9. **Child complaint confidentiality:** a child can read only their own complaint and status; another child, the NGO, foster family, accused person, admin, and unrelated staff cannot read it.
10. **Child document ownership:** a child can view only their own records and documents; staff access is limited to records assigned to that staff member and is audited.
11. **Child account reset:** a forgotten PIN cannot be reset online; reset requires the authorised in-person process.
12. **Adult own-record view:** an identity-verified adult-after-care account can read only its own eligible records, documents, complaints, support requests, consents, and data-rights requests.
13. **Adult export scope:** the adult data download includes only that adult's permitted records and never another person's record, a staff-only note, or an unrelated case.
14. **Adult deletion review:** an adult request to delete non-legal data is recorded for staff review; no minimal legal record is deleted by a direct user request.
15. **Adult verification:** an adult who has not completed staff identity verification cannot use the after-care data view/export path.

## Parent and adoption workflow boundaries

16. **No child browsing before referral:** a parent cannot list, search, or enumerate children before an official CARINGS referral.
17. **Referral isolation:** Parent A cannot read the referred child details, referral reference, meetings, notes, or tracker data of Parent B.
18. **Child media gate:** child photographs/media are unavailable before a recorded District Magistrate adoption order; archive access is limited to the officially referred family and authorised staff after the order.
19. **Parent document isolation:** Parent A cannot read or download Parent B's identity, address, income, medical, or police-verification document.
20. **Parent preferences:** religion/age counselling preferences are visible only to authorised staff and cannot be used in child search/list filters; no caste/creed field exists.
21. **Tracker transition integrity:** parents cannot submit or alter staff-only tracker steps, CARINGS registration number, referral reference, or adoption-order fields.

## NGO and child-entry boundaries

22. **NGO ownership:** NGO A can see only its own child entries, compliance records, monthly reports, and funding requests; it cannot change an `ngo_id` to access NGO B.
23. **CWC order requirement:** an NGO child entry without a valid non-empty CWC order reference is rejected on the server and by database constraints.
24. **NGO complaint isolation:** NGO staff cannot select, count, infer, or download complaints made by children in their own NGO or another NGO.
25. **NGO verification gate:** an unverified, suspended, or rejected NGO cannot use authenticated NGO workspace actions or add records.
26. **Public NGO directory:** the read-only directory returns only verified public recognition fields; it excludes private compliance files, contacts, pending organisations, and child records.
27. **Funding request isolation:** an NGO can create/read only its own funding requests and supporting-document metadata; it cannot approve its request or change approval actors.

## Protection, grievance, admin, and funding boundaries

28. **Protection assignment/on-call scope:** a protection officer can read only assigned or on-call complaints, and every complaint/list/detail read creates an audit entry.
29. **Admin complaint denial:** admin cannot read a complaint, complaint event, or complaint identity, even if the admin knows its UUID.
30. **Grievance committee exclusivity:** only grievance committee staff can read staff grievance content; admin, caseworker, protection officer, verification staff, and the person named in the grievance cannot.
31. **Anonymous grievance:** an anonymous grievance stores no submitting user identifier; the API response, UI, audit metadata, and staff directory cannot reveal or infer the author.
32. **Grievance assignment:** reviewer A can claim an unassigned item and read only that assigned grievance; reviewer B cannot read it or update its status, and unassigned grievance content is not selectable before claim. Every allowed read is audit-logged without revealing an anonymous author.
33. **Funding dual approval:** one admin cannot provide both approvals; two distinct MFA-verified admins are required before approval status changes.
34. **Funding supporting document:** only an MFA-verified admin can read/download the linked support document while its request is under review; every download creates the funding-document audit event. Other NGO documents remain inaccessible.
35. **No bulk export:** no role can bulk export or bulk download children's records; repeated ID enumeration does not bypass row-level policy or rate limits.

## Storage, audit, and browser safety

36. **Private bucket:** anonymous users and unrelated authenticated roles cannot list or read the private document bucket or object paths.
37. **Signed-link expiry:** each authorised signed URL has an expiry of no more than 60 seconds; a copied URL fails after expiry.
38. **Upload validation:** reject oversized files, disallowed extensions/types, mismatched content type, and untrusted names; server-generated random object paths are used.
39. **Append-only audit/event data:** authenticated clients cannot update or delete `audit_log` or `complaint_events`; trigger protections reject privileged mutation attempts that are not legitimate inserts.
40. **Audit coverage:** views and changes of child records, child documents, complaints, and adoption trackers write append-only audit events; audit failure fails closed for sensitive reads/downloads.
41. **Quick Exit:** on every child page and complaint/report form, one tap immediately clears the visible DOM, signs out the local session, replaces the current entry with the neutral exit page, and prevents a Back-restored sensitive route from remaining open; verify browser Back/forward cache behavior on supported browsers.
42. **Rate limits and CAPTCHA:** repeated login/form attempts are throttled; parent signup fails closed when Turnstile verification is missing or invalid.
43. **Response headers and injection:** verify CSP, HSTS, content-type/referrer/frame protections; user-entered complaint text is rendered as text and cannot inject HTML or script.
44. **Secret isolation:** browser bundles, logs, HTML, source maps, and repository do not contain the service-role key, DB password, CAPTCHA secret, PIN pepper, rate-limit secret, or email-provider key.

## Results log

| Date | Environment | Cases run | Pass/fail | Notes / issue reference |
| --- | --- | --- | --- | --- |
| Not run | No connected Supabase test project was supplied | None | N/A | Create a disposable project and fake accounts before recording any test results. |
