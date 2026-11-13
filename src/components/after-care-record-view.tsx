import "server-only";

import { getLocale, getTranslations } from "next-intl/server";
import { PrivateDocumentDownloadButton } from "@/components/private-document-download-button";
import { logSensitiveAccess } from "@/lib/audit";
import type { UserSupabase } from "@/lib/auth";

type Row = Record<string, any>;
type Option = { value: string; label: string };

function optionLabel(options: Option[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function formatDate(value: string, locale: string, withTime = false) {
  const dateValue = value.includes("T") ? value : `${value}T12:00:00`;
  return new Intl.DateTimeFormat(locale, withTime
    ? { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }
    : { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(new Date(dateValue));
}

async function auditRows(supabase: UserSupabase, table: string, rows: Row[]) {
  for (const row of rows) {
    if (!await logSensitiveAccess(supabase, table, row.id)) return false;
  }
  return true;
}

export async function AfterCareRecordView({ supabase, userId }: { supabase: UserSupabase; userId: string }) {
  const locale = await getLocale();
  const t = await getTranslations("Child");
  const common = await getTranslations("Common");
  const [childrenResult, consentsResult, rightsResult] = await Promise.all([
    supabase.from("children").select("id,public_code,status,cwc_order_number,created_at").eq("user_id", userId).order("created_at"),
    supabase.from("consents").select("id,consent_type,document_version,consented_at").eq("user_id", userId).order("consented_at"),
    supabase.from("data_rights_requests").select("id,request_type,status,reason,created_at,reviewed_at").eq("user_id", userId).order("created_at", { ascending: false })
  ]);
  if (childrenResult.error || consentsResult.error || rightsResult.error) return <p className="empty-state" role="alert">{common("setupRequired")}</p>;

  const children = (childrenResult.data ?? []) as Row[];
  const consents = (consentsResult.data ?? []) as Row[];
  const rightsRequests = (rightsResult.data ?? []) as Row[];
  if (!await auditRows(supabase, "children", children) || !await auditRows(supabase, "data_rights_requests", rightsRequests)) {
    return <p className="empty-state" role="alert">{common("setupRequired")}</p>;
  }

  let documents: Row[] = [];
  let complaints: Row[] = [];
  let supportRequests: Row[] = [];
  const privateByChild = new Map<string, Row>();
  if (children.length) {
    if (!await logSensitiveAccess(supabase, "complaint_list", null, "complaint_list")) return <p className="empty-state" role="alert">{common("setupRequired")}</p>;
    const childIds = children.map((child) => child.id as string);
    const [documentsResult, complaintsResult, supportResult, privateResult] = await Promise.all([
      supabase.from("documents").select("id,child_id,document_type,created_at").in("child_id", childIds).order("created_at", { ascending: false }),
      supabase.from("complaints").select("id,child_id,category,urgency,details,status,created_at").eq("reporter_user_id", userId).in("child_id", childIds).order("created_at", { ascending: false }),
      supabase.from("support_requests").select("id,child_id,topic,details,status,created_at").eq("requester_user_id", userId).in("child_id", childIds).order("created_at", { ascending: false }),
      supabase.from("child_private").select("child_id,legal_name,date_of_birth,background")
    ]);
    if (documentsResult.error || complaintsResult.error || supportResult.error || privateResult.error) return <p className="empty-state" role="alert">{common("setupRequired")}</p>;
    documents = (documentsResult.data ?? []) as Row[];
    complaints = (complaintsResult.data ?? []) as Row[];
    supportRequests = (supportResult.data ?? []) as Row[];
    for (const record of (privateResult.data ?? []) as Row[]) privateByChild.set(record.child_id, record);
    for (const child of children) {
      const record = privateByChild.get(child.id);
      if (record && !await logSensitiveAccess(supabase, "child_private", child.id)) return <p className="empty-state" role="alert">{common("setupRequired")}</p>;
    }
    if (!await auditRows(supabase, "documents", documents)
      || !await auditRows(supabase, "complaints", complaints)
      || !await auditRows(supabase, "support_requests", supportRequests)) {
      return <p className="empty-state" role="alert">{common("setupRequired")}</p>;
    }
  }

  const childStatuses = t.raw("afterCareStatusOptions") as Option[];
  const documentTypes = t.raw("afterCareDocumentTypeOptions") as Option[];
  const dataRightTypes = t.raw("afterCareDataRightTypeOptions") as Option[];
  const dataRightStatuses = t.raw("afterCareDataRightStatusOptions") as Option[];
  const consentTypes = t.raw("afterCareConsentTypeOptions") as Option[];
  const supportTopicOptions = t.raw("afterCareSupportTopicOptions") as Option[];
  const supportStatusOptions = t.raw("afterCareSupportStatusOptions") as Option[];
  const complaintCategories = t.raw("categories") as string[];
  const complaintUrgencies = t.raw("urgencies") as string[];
  const complaintStatuses = t.raw("reportStatuses") as string[];
  const supportTopics = t.raw("supportTopics") as string[];
  const supportStatuses = t.raw("supportStatuses") as string[];
  const childById = new Map(children.map((child) => [child.id, child.public_code]));

  return <div className="dashboard-sections after-care-records">
    <section className="dashboard-section" aria-labelledby="after-care-records-title">
      <h2 id="after-care-records-title">{t("afterCareRecordsTitle")}</h2>
      {!children.length ? <p className="empty-state">{common("noRecords")}</p> : children.map((child) => {
        const privateRecord = privateByChild.get(child.id);
        return <article className="record-card" key={child.id}>
          <h3>{child.public_code}</h3>
          <p>{t("afterCareRecordStatus")}: {optionLabel(childStatuses, child.status)}</p>
          {child.cwc_order_number && <p>{t("afterCareCwcOrderReference")}: {child.cwc_order_number}</p>}
          {privateRecord && <dl className="record-details">
            <div><dt>{t("afterCareLegalName")}</dt><dd>{privateRecord.legal_name}</dd></div>
            <div><dt>{t("afterCareBirthDate")}</dt><dd>{formatDate(privateRecord.date_of_birth, locale)}</dd></div>
            {privateRecord.background && <div><dt>{t("afterCareBackground")}</dt><dd>{privateRecord.background}</dd></div>}
          </dl>}
          <time dateTime={child.created_at}>{formatDate(child.created_at, locale)}</time>
        </article>;
      })}
    </section>

    <section className="dashboard-section" aria-labelledby="after-care-documents-title">
      <h2 id="after-care-documents-title">{t("afterCareDocumentsTitle")}</h2>
      {!documents.length ? <p className="empty-state">{common("noRecords")}</p> : <ul className="record-list">{documents.map((document) => <li className="record-row" key={document.id}>
        <span>{childById.get(document.child_id)} · {optionLabel(documentTypes, document.document_type)}</span>
        <time dateTime={document.created_at}>{formatDate(document.created_at, locale)}</time>
        <PrivateDocumentDownloadButton documentId={document.id} table="documents" />
      </li>)}</ul>}
    </section>

    <section className="dashboard-section" aria-labelledby="after-care-complaints-title">
      <h2 id="after-care-complaints-title">{t("afterCareComplaintsTitle")}</h2>
      {!complaints.length ? <p className="empty-state">{common("noRecords")}</p> : complaints.map((complaint) => {
        const categoryIndex = ["abuse", "harassment", "neglect", "food_health", "education", "other"].indexOf(complaint.category);
        const urgencyIndex = ["normal", "serious", "emergency"].indexOf(complaint.urgency);
        const statusIndex = ["open", "reviewing", "action_taken", "closed"].indexOf(complaint.status);
        return <article className="record-card complaint-record" key={complaint.id}>
          <h3>{childById.get(complaint.child_id)}</h3>
          <p>{categoryIndex >= 0 ? complaintCategories[categoryIndex] : t("reportTitle")} · {urgencyIndex >= 0 ? complaintUrgencies[urgencyIndex] : ""}</p>
          <p>{t("detailsLabel")}: {complaint.details}</p>
          <p>{t("reportStatus")}: {statusIndex >= 0 ? complaintStatuses[statusIndex] : common("status")}</p>
          <time dateTime={complaint.created_at}>{formatDate(complaint.created_at, locale, true)}</time>
        </article>;
      })}
    </section>

    <section className="dashboard-section" aria-labelledby="after-care-support-title">
      <h2 id="after-care-support-title">{t("afterCareSupportTitle")}</h2>
      {!supportRequests.length ? <p className="empty-state">{common("noRecords")}</p> : supportRequests.map((request) => {
        return <article className="record-card" key={request.id}>
          <h3>{childById.get(request.child_id)}</h3>
          <p>{optionLabel(supportTopicOptions, request.topic)}</p>
          {request.details && <p>{request.details}</p>}
          <p>{common("status")}: {optionLabel(supportStatusOptions, request.status)}</p>
          <time dateTime={request.created_at}>{formatDate(request.created_at, locale, true)}</time>
        </article>;
      })}
    </section>

    <section className="dashboard-section" aria-labelledby="after-care-consents-title">
      <h2 id="after-care-consents-title">{t("afterCareConsentsTitle")}</h2>
      {!consents.length ? <p className="empty-state">{common("noRecords")}</p> : <ul className="record-list">{consents.map((consent) => <li className="record-row" key={consent.id}>
        <span>{optionLabel(consentTypes, consent.consent_type)} · {consent.document_version}</span>
        <time dateTime={consent.consented_at}>{formatDate(consent.consented_at, locale, true)}</time>
      </li>)}</ul>}
    </section>

    <section className="dashboard-section" aria-labelledby="after-care-rights-title">
      <h2 id="after-care-rights-title">{t("afterCareDataRightsTitle")}</h2>
      {!rightsRequests.length ? <p className="empty-state">{common("noRecords")}</p> : <ul className="record-list">{rightsRequests.map((request) => <li className="record-row" key={request.id}>
        <span>{optionLabel(dataRightTypes, request.request_type)} · {optionLabel(dataRightStatuses, request.status)}</span>
        {request.reason && <span>{request.reason}</span>}
        <time dateTime={request.created_at}>{formatDate(request.created_at, locale, true)}</time>
        {request.reviewed_at && <span>{t("afterCareReviewedAt")}: {formatDate(request.reviewed_at, locale, true)}</span>}
      </li>)}</ul>}
    </section>
  </div>;
}
