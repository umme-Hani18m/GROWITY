import "server-only";

import { getLocale, getTranslations } from "next-intl/server";
import { logCaseRecordAccess, logSensitiveAccess } from "@/lib/audit";
import type { UserSupabase } from "@/lib/auth";
import { PrivateDocumentDownloadButton } from "@/components/private-document-download-button";
import { FundingDecisionForm, NgoVerificationForm, StaffSubRoleForm } from "@/components/staff-admin-forms";
import { CaseMeetingForm, ChildPinLockoutResetForm, ClaimFosterInterestForm, CompatibilityNoteForm, FosterFollowUpForm, StaffChildAccountForm, SupportRequestStatusForm, TrackerStepForm } from "@/components/staff-caseworker-forms";
import { AdultIdentityRequests, ChildOnboardingRequests } from "@/components/staff-onboarding-forms";
import { ClaimStaffGrievanceForm, EmergencyOutcomeForm, GrievanceStatusForm, ParentDocumentDecisionForm } from "@/components/staff-protection-forms";

type StaffRole = "verification_team" | "caseworker" | "protection_officer" | "grievance_committee" | "admin";
type Row = Record<string, any>;

async function auditRows(supabase: UserSupabase, table: string, rows: Row[]): Promise<boolean> {
  for (const row of rows) {
    if (!await logSensitiveAccess(supabase, table, row.id)) return false;
  }
  return true;
}

function labelFor(options: Array<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function formatDate(value: string, locale: string, withTime = false) {
  const dateValue = value.includes("T") ? value : `${value}T12:00:00`;
  return new Intl.DateTimeFormat(locale, withTime
    ? { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }
    : { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(dateValue));
}

function DashboardUnavailable({ message }: { message: string }) {
  return <p className="empty-state" role="alert">{message}</p>;
}

export async function StaffDashboard({ role, supabase, userId }: { role: StaffRole; supabase: UserSupabase; userId: string }) {
  if (role === "caseworker") return <CaseworkerDashboard supabase={supabase} userId={userId} />;
  if (role === "verification_team") return <VerificationDashboard supabase={supabase} />;
  if (role === "protection_officer") return <ProtectionDashboard supabase={supabase} />;
  if (role === "grievance_committee") return <GrievanceDashboard supabase={supabase} userId={userId} />;
  if (role === "admin") return <AdminDashboard supabase={supabase} userId={userId} />;
  return <DashboardUnavailable message="" />;
}

async function CaseworkerDashboard({ supabase, userId }: { supabase: UserSupabase; userId: string }) {
  const locale = await getLocale();
  const t = await getTranslations("Team");
  const common = await getTranslations("Common");
  const [appsResult, childrenResult, fosterResult, childRequestsResult, adultRequestsResult] = await Promise.all([
    supabase.from("parent_applications").select("id,status,created_at").order("created_at", { ascending: false }),
    supabase.from("children").select("id,public_code,status,ngo_id,created_at").order("created_at", { ascending: false }),
    supabase.from("foster_interests").select("id,name,contact,state,status,forwarded_to_dcpu,cwc_decision,created_at").order("created_at", { ascending: false }),
    supabase.from("child_onboarding_requests").select("id,preferred_name,age_range,state,safe_contact,status,created_at").in("status", ["pending", "in_review"]).order("created_at", { ascending: false }),
    supabase.from("adult_identity_requests").select("id,pathway,email,full_name,date_of_birth,care_organisation,milestone_year,status,created_at").in("status", ["pending", "in_review"]).order("created_at", { ascending: false })
  ]);
  if (appsResult.error || childrenResult.error || fosterResult.error || childRequestsResult.error || adultRequestsResult.error) return <DashboardUnavailable message={t("workspaceUnavailable")} />;
  const applications = (appsResult.data ?? []) as Row[];
  const children = (childrenResult.data ?? []) as Row[];
  const fosterInterests = (fosterResult.data ?? []) as Row[];
  const childOnboardingRequests = (childRequestsResult.data ?? []) as Row[];
  const adultIdentityRequests = (adultRequestsResult.data ?? []) as Row[];
  if (!await auditRows(supabase, "parent_applications", applications)
    || !await auditRows(supabase, "children", children)
    || !await auditRows(supabase, "foster_interests", fosterInterests)
    || !await auditRows(supabase, "child_onboarding_requests", childOnboardingRequests)
    || !await auditRows(supabase, "adult_identity_requests", adultIdentityRequests)) return <DashboardUnavailable message={t("workspaceUnavailable")} />;

  const appIds = applications.map((row) => row.id as string);
  const childIds = children.map((row) => row.id as string);
  const [referralsResult, trackersResult, documentsResult, supportResult] = await Promise.all([
    appIds.length ? supabase.from("parent_child_referrals").select("application_id,child_id,referral_reference,referred_at").in("application_id", appIds) : Promise.resolve({ data: [], error: null }),
    appIds.length ? supabase.from("adoption_tracker").select("id,application_id,step,step_date,carings_registration_number,referral_reference,adoption_order_number,adoption_order_date").in("application_id", appIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    childIds.length ? supabase.from("documents").select("id,child_id,document_type,created_at").in("child_id", childIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    childIds.length ? supabase.from("support_requests").select("id,child_id,topic,details,status,created_at").in("child_id", childIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null })
  ]);
  if (referralsResult.error || trackersResult.error || documentsResult.error || supportResult.error) return <DashboardUnavailable message={t("workspaceUnavailable")} />;
  const referrals = (referralsResult.data ?? []) as Row[];
  const trackers = (trackersResult.data ?? []) as Row[];
  const documents = (documentsResult.data ?? []) as Row[];
  const support = (supportResult.data ?? []) as Row[];
  if (!await auditRows(supabase, "adoption_tracker", trackers)
    || !await auditRows(supabase, "documents", documents)
    || !await auditRows(supabase, "support_requests", support)) return <DashboardUnavailable message={t("workspaceUnavailable")} />;

  const referredPairs = referrals.map((row) => `${row.application_id}:${row.child_id}`);
  const meetingResult = referredPairs.length
    ? await supabase.from("case_meetings").select("id,application_id,child_id,starts_at,meeting_type,location,status").in("application_id", appIds).order("starts_at")
    : { data: [], error: null };
  const noteResult = referredPairs.length
    ? await supabase.from("compatibility_notes").select("id,application_id,child_id,note,created_at").in("application_id", appIds).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (meetingResult.error || noteResult.error) return <DashboardUnavailable message={t("workspaceUnavailable")} />;
  const meetings = (meetingResult.data ?? []) as Row[];
  const notes = (noteResult.data ?? []) as Row[];
  for (const row of meetings) if (!await logCaseRecordAccess(supabase, "case_meetings", row.id)) return <DashboardUnavailable message={t("workspaceUnavailable")} />;
  for (const row of notes) if (!await logCaseRecordAccess(supabase, "compatibility_notes", row.id)) return <DashboardUnavailable message={t("workspaceUnavailable")} />;

  const childById = new Map(children.map((child) => [child.id, child]));
  const appById = new Map(applications.map((application) => [application.id, application]));
  const steps = t.raw("trackerStepOptions") as Array<{ value: string; label: string }>;
  const applicationStatuses = t.raw("applicationStatusOptions") as Array<{ value: string; label: string }>;
  const meetingTypes = t.raw("meetingTypeOptions") as Array<{ value: string; label: string }>;
  const documentTypes = t.raw("childDocumentTypeOptions") as Array<{ value: string; label: string }>;
  const supportTopics = t.raw("supportTopicOptions") as Array<{ value: string; label: string }>;
  const supportStatuses = t.raw("supportStatusOptions") as Array<{ value: string; label: string }>;
  const fosterStatuses = t.raw("fosterStatusOptions") as Array<{ value: string; label: string }>;
  return <div className="dashboard-sections">
    <ChildOnboardingRequests requests={childOnboardingRequests as any} />
    <AdultIdentityRequests requests={adultIdentityRequests as any} />
    <section className="dashboard-section"><h2>{t("createChildAccount")}</h2><p>{t("noChildrenAssigned")}</p><StaffChildAccountForm /></section>
    <section className="dashboard-section"><h2>{t("childLockoutTitle")}</h2><p>{t("childLockoutDescription")}</p>
      {children.length === 0 ? <p className="empty-state">{t("noChildrenAssigned")}</p> : children.map((child) => <ChildPinLockoutResetForm key={child.id} childId={child.id} publicCode={child.public_code} />)}
    </section>
    <section className="dashboard-section"><h2>{t("caseQueueTitle")}</h2>
      {applications.length === 0 && <p className="empty-state">{t("noAssignedCases")}</p>}
      {applications.map((application) => {
        const appReferrals = referrals.filter((row) => row.application_id === application.id);
        const appTrackers = trackers.filter((row) => row.application_id === application.id);
        return <article className="record-card" key={application.id}>
          <h3>{t("applicationRecord")}</h3>
          <p>{common("status")}: {labelFor(applicationStatuses, application.status)}</p>
          {appTrackers.length > 0 && <ul className="record-list">{appTrackers.map((row) => <li key={row.id}>{labelFor(steps, row.step)} | {formatDate(row.step_date, locale)}</li>)}</ul>}
          <TrackerStepForm applicationId={application.id} children={children.map((child) => ({ id: child.id, publicCode: child.public_code }))} />
          {appReferrals.map((referral) => {
            const child = childById.get(referral.child_id);
            if (!child) return null;
            const appMeetings = meetings.filter((row) => row.application_id === application.id && row.child_id === child.id);
            const appNotes = notes.filter((row) => row.application_id === application.id && row.child_id === child.id);
            return <div className="referral-card" key={`${application.id}:${child.id}`}>
              <h4>{t("childReferrals")}</h4>
              <p>{child.public_code} · {referral.referral_reference}</p>
              <h5>{t("caseMeetings")}</h5>
              {appMeetings.length ? <ul className="record-list">{appMeetings.map((meeting) => <li key={meeting.id}>{formatDate(meeting.starts_at, locale, true)} · {labelFor(meetingTypes, meeting.meeting_type)}</li>)}</ul> : <p>{t("noMeetings")}</p>}
              <CaseMeetingForm applicationId={application.id} childId={child.id} />
              <h5>{t("compatibilityNoteLabel")}</h5>
              {appNotes.map((note) => <p className="staff-note" key={note.id}>{note.note}</p>)}
              <CompatibilityNoteForm applicationId={application.id} childId={child.id} />
            </div>;
          })}
        </article>;
      })}
    </section>
    <section className="dashboard-section"><h2>{t("childDocumentsTitle")}</h2>
      {documents.length === 0 ? <p className="empty-state">{common("noRecords")}</p> : <ul className="record-list">{documents.map((doc) => <li key={doc.id}>
        <span>{childById.get(doc.child_id)?.public_code ?? ""} · {labelFor(documentTypes, doc.document_type)}</span>
        <PrivateDocumentDownloadButton documentId={doc.id} table="documents" />
      </li>)}</ul>}
    </section>
    <section className="dashboard-section"><h2>{t("supportRequestsQueueTitle")}</h2>
      {support.length === 0 ? <p className="empty-state">{common("noRecords")}</p> : support.map((request) => <article className="record-card" key={request.id}>
        <p>{childById.get(request.child_id)?.public_code} · {labelFor(supportTopics, request.topic)}</p><p>{request.details}</p><p>{common("status")}: {labelFor(supportStatuses, request.status)}</p>
        <SupportRequestStatusForm requestId={request.id} />
      </article>)}
    </section>
    <section className="dashboard-section"><h2>{t("fosterQueueTitle")}</h2><ClaimFosterInterestForm />
      {fosterInterests.length === 0 ? <p className="empty-state">{common("noRecords")}</p> : fosterInterests.map((interest) => <article className="record-card" key={interest.id}>
        <h3>{interest.name}</h3><p>{interest.contact} · {interest.state}</p><p>{labelFor(fosterStatuses, interest.status)}</p><FosterFollowUpForm interestId={interest.id} />
      </article>)}
    </section>
  </div>;
}

async function VerificationDashboard({ supabase }: { supabase: UserSupabase }) {
  const locale = await getLocale();
  const t = await getTranslations("Team");
  const common = await getTranslations("Common");
  const { data: applications, error: appError } = await supabase.from("parent_applications").select("id,status,created_at").order("created_at", { ascending: false });
  if (appError) return <DashboardUnavailable message={t("workspaceUnavailable")} />;
  const apps = (applications ?? []) as Row[];
  if (!await auditRows(supabase, "parent_applications", apps)) return <DashboardUnavailable message={t("workspaceUnavailable")} />;
  const appIds = apps.map((row) => row.id as string);
  const docsResult = appIds.length
    ? await supabase.from("parent_documents").select("id,application_id,document_type,verification_status,created_at").in("application_id", appIds).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (docsResult.error) return <DashboardUnavailable message={t("workspaceUnavailable")} />;
  const docs = (docsResult.data ?? []) as Row[];
  if (!await auditRows(supabase, "parent_documents", docs)) return <DashboardUnavailable message={t("workspaceUnavailable")} />;
  const types = t.raw("parentDocumentTypeOptions") as Array<{ value: string; label: string }>;
  const statuses = t.raw("parentDocumentStatusOptions") as Array<{ value: string; label: string }>;
  return <section className="dashboard-section"><h2>{t("documentVerification")}</h2>
    {!docs.length ? <p className="empty-state">{t("noParentDocuments")}</p> : docs.map((doc) => <article className="record-card" key={doc.id}>
      <p>{labelFor(types, doc.document_type)} · {labelFor(statuses, doc.verification_status)}</p><p>{t("applicationRecord")}: {String(doc.application_id).slice(0, 8)}</p>
      <time dateTime={doc.created_at}>{formatDate(doc.created_at, locale)}</time>
      <PrivateDocumentDownloadButton documentId={doc.id} table="parent_documents" />
      <ParentDocumentDecisionForm documentId={doc.id} />
    </article>)}
    <p className="form-note">{common("sessionNotice")}</p>
  </section>;
}

async function ProtectionDashboard({ supabase }: { supabase: UserSupabase }) {
  const locale = await getLocale();
  const t = await getTranslations("Team");
  if (!await logSensitiveAccess(supabase, "complaint_list", null, "complaint_list")) return <DashboardUnavailable message={t("workspaceUnavailable")} />;
  const { data, error } = await supabase.from("complaints")
    .select("id,child_id,category,urgency,details,status,due_at,outcome_contacted,outcome_contacted_at,outcome_method")
    .order("created_at", { ascending: false });
  if (error) return <DashboardUnavailable message={t("workspaceUnavailable")} />;
  const reports = (data ?? []) as Row[];
  if (!await auditRows(supabase, "complaints", reports)) return <DashboardUnavailable message={t("workspaceUnavailable")} />;
  const childIds = [...new Set(reports.map((row) => row.child_id as string))];
  const childById = new Map<string, string>();
  if (childIds.length) {
    const childRows = await supabase.from("children").select("id,public_code").in("id", childIds);
    if (childRows.error || !await auditRows(supabase, "children", (childRows.data ?? []) as Row[])) return <DashboardUnavailable message={t("workspaceUnavailable")} />;
    for (const child of (childRows.data ?? []) as Row[]) childById.set(child.id, child.public_code);
  }
  const categoryOptions = t.raw("complaintCategoryOptions") as Array<{ value: string; label: string }>;
  const urgencyOptions = t.raw("urgencyOptions") as Array<{ value: string; label: string }>;
  return <section className="dashboard-section"><h2>{t("complaintQueueTitle")}</h2>
    {!reports.length && <p className="empty-state">{t("noComplaints")}</p>}
    {reports.map((report) => <article className="record-card complaint-record" key={report.id}>
      <p><strong>{labelFor(urgencyOptions, report.urgency)}</strong> · {labelFor(categoryOptions, report.category)}</p>
      <p>{t("childRecord")}: {childById.get(report.child_id) ?? ""}</p>
      <p>{t("complaintDetails")}: {report.details}</p>
      <p>{t("deadline")}: {report.due_at ? formatDate(report.due_at, locale, true) : "Not recorded"}</p>
      {report.urgency === "emergency" && report.due_at && Date.parse(report.due_at) < Date.now() && !report.outcome_contacted && <p className="urgent-flag" role="alert">{t("complaintOverdue")}</p>}
      {report.outcome_contacted ? <p className="form-note">{t("outcomeRecorded")}</p> : report.urgency === "emergency" ? <EmergencyOutcomeForm complaintId={report.id} /> : null}
    </article>)}
  </section>;
}

async function GrievanceDashboard({ supabase, userId }: { supabase: UserSupabase; userId: string }) {
  const t = await getTranslations("Team");
  const { data, error } = await supabase.from("staff_grievances")
    .select("id,is_anonymous,category,person_named,details,status,created_at")
    .eq("assigned_reviewer_id", userId)
    .order("created_at", { ascending: false });
  if (error) return <DashboardUnavailable message={t("workspaceUnavailable")} />;
  const grievances = (data ?? []) as Row[];
  if (!await auditRows(supabase, "staff_grievances", grievances)) return <DashboardUnavailable message={t("workspaceUnavailable")} />;
  const categoryOptions = t.raw("grievanceCategoryOptions") as Array<{ value: string; label: string }>;
  const statusOptions = t.raw("grievanceStatusOptions") as Array<{ value: string; label: string }>;
  return <section className="dashboard-section"><h2>{t("grievanceQueueTitle")}</h2>
    <ClaimStaffGrievanceForm />
    {!grievances.length && <p className="empty-state">{t("grievanceQueueEmpty")}</p>}
    {grievances.map((grievance) => <article className="record-card" key={grievance.id}>
      <p>{labelFor(categoryOptions, grievance.category)} · {grievance.is_anonymous ? t("anonymous") : t("identified")}</p>
      {grievance.person_named && <p>{t("personNamed")}: {grievance.person_named}</p>}
      <p>{grievance.details}</p><p>{t("status")}: {labelFor(statusOptions, grievance.status)}</p><GrievanceStatusForm grievanceId={grievance.id} />
    </article>)}
  </section>;
}

async function AdminDashboard({ supabase, userId }: { supabase: UserSupabase; userId: string }) {
  const locale = await getLocale();
  const t = await getTranslations("Team");
  const common = await getTranslations("Common");
  const [ngosResult, fundingResult, staffResult] = await Promise.all([
    supabase.from("ngos").select("id,display_name,recognition_type,registration_number,recognition_number,recognition_date,verification_status,renewal_date").order("created_at", { ascending: false }),
    supabase.from("funding_requests").select("id,ngo_id,amount_paise,purpose,support_document_id,status,approver_one_id,approver_two_id,created_at").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id,full_name,sub_role").eq("role", "staff").order("full_name")
  ]);
  if (ngosResult.error || fundingResult.error || staffResult.error) return <DashboardUnavailable message={t("workspaceUnavailable")} />;
  const ngos = (ngosResult.data ?? []) as Row[];
  const funding = (fundingResult.data ?? []) as Row[];
  const staff = (staffResult.data ?? []) as Row[];
  const ngoTypes = t.raw("ngoRecognitionTypeOptions") as Array<{ value: string; label: string }>;
  const roles = t.raw("staffSubRoleOptions") as Array<{ value: string; label: string }>;
  const ngoStatuses = t.raw("ngoStatusOptions") as Array<{ value: string; label: string }>;
  const fundingStatuses = t.raw("fundingStatusOptions") as Array<{ value: string; label: string }>;
  return <div className="dashboard-sections">
    <section className="dashboard-section"><h2>{t("staffDirectory")}</h2>
      {staff.map((person) => <article className="record-card" key={person.id}><h3>{person.full_name || t("staffMember")}</h3>
        <p>{labelFor(roles, person.sub_role)}</p>{person.id !== userId && <StaffSubRoleForm staffId={person.id} currentRole={person.sub_role} />}
      </article>)}
    </section>
    <section className="dashboard-section"><h2>{t("verifiedDirectoryAdmin")}</h2>
      {!ngos.length && <p className="empty-state">{common("noRecords")}</p>}
      {ngos.map((ngo) => <article className="record-card" key={ngo.id}>
        <h3>{ngo.display_name}</h3><p>{labelFor(ngoTypes, ngo.recognition_type)}</p>
        <p>{t("registrationNumber")}: {ngo.registration_number}</p><p>{t("recognitionNumber")}: {ngo.recognition_number}</p>
        <p>{t("recognitionDate")}: {formatDate(ngo.recognition_date, locale)}</p><p>{t("renewalDate")}: {ngo.renewal_date ? formatDate(ngo.renewal_date, locale) : "Not recorded"}</p>
        <p>{labelFor(ngoStatuses, ngo.verification_status)}</p><NgoVerificationForm ngoId={ngo.id} status={ngo.verification_status} />
      </article>)}
    </section>
    <section className="dashboard-section"><h2>{t("fundingQueueTitle")}</h2>
      {!funding.length && <p className="empty-state">{common("noRecords")}</p>}
      {funding.map((request) => <article className="record-card" key={request.id}>
        <p>{t("fundingPurpose")}: {request.purpose}</p><p>{t("fundingAmount")}: {new Intl.NumberFormat(locale, { style: "currency", currency: "INR" }).format(Number(request.amount_paise) / 100)}</p>
        <p>{labelFor(fundingStatuses, request.status)}</p>
        {(["submitted", "under_review"].includes(request.status)) && <PrivateDocumentDownloadButton documentId={request.support_document_id} table="documents" />}
        <p>{t("approvalCount")}: {(request.approver_one_id ? 1 : 0) + (request.approver_two_id ? 1 : 0)} / 2</p>
        {(["submitted", "under_review"].includes(request.status)) && <FundingDecisionForm requestId={request.id} />}
      </article>)}
    </section>
  </div>;
}
