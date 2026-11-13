import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContext } from "@/components/page-context";
import { NgoChildEntryForm, NgoDocumentUploadForm, NgoFundingForm, NgoMonthlyReportForm } from "@/components/ngo-workspace-forms";
import { PrivateDocumentDownloadButton } from "@/components/private-document-download-button";
import { logSensitiveAccess } from "@/lib/audit";
import { getVerifiedNgo } from "@/lib/ngo";
import { notFound } from "next/navigation";

export default async function NgoDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("NGO");
  const common = await getTranslations("Common");
  const current = await getVerifiedNgo();
  if (!current) notFound();

  const [childrenResult, reportsResult, documentsResult, fundingResult] = await Promise.all([
    current.supabase.from("children").select("id, public_code, status, created_at").order("created_at", { ascending: false }),
    current.supabase.from("ngo_reports").select("id, report_month, new_entries_count, created_at").order("report_month", { ascending: false }),
    current.supabase.from("documents").select("id, document_type, created_at").eq("ngo_id", current.organization.id).order("created_at", { ascending: false }),
    current.supabase.from("funding_requests").select("id, amount_paise, status, purpose, created_at, support_document_id").eq("ngo_id", current.organization.id).order("created_at", { ascending: false })
  ]);

  const children = childrenResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const childLogs = await Promise.all(children.map((child) => logSensitiveAccess(current.supabase, "children", child.id)));
  const documentLogs = await Promise.all(documents.map((document) => logSensitiveAccess(current.supabase, "documents", document.id)));
  const auditOk = childLogs.every(Boolean) && documentLogs.every(Boolean);
  const fundingDocuments = documents.filter((document) => document.document_type === "funding_support");
  const fundingStatuses = t.raw("fundingStatuses") as string[];
  const statusLabels: Record<string, string> = {
    submitted: fundingStatuses[0],
    under_review: fundingStatuses[1],
    approved: fundingStatuses[2],
    rejected: fundingStatuses[3],
    paid: fundingStatuses[4]
  };
  const error = childrenResult.error || reportsResult.error || documentsResult.error || fundingResult.error;

  return (
    <main id="main-content" className="page-main content-width role-page">
      <PageContext pageKey="ngo" />
      <section className="role-hero" aria-labelledby="ngo-dashboard-title">
        
        <h1 id="ngo-dashboard-title">{current.organization.display_name}</h1>
        <p className="role-lead">{current.organization.recognition_number} · {current.organization.state}</p>
        <p>{t("dashboardRenewal")}: {current.organization.renewal_date ?? common("noRecords")}</p>
      </section>
      <section className="volunteer-entry compact-volunteer-entry" aria-label={common("volunteering")}>
        <div><h2>{t("dashboardTitle")}: {common("volunteering")}</h2><p>{(await getTranslations("Volunteering"))("intro")}</p></div>
        <Link className="button button-secondary" href={`/${locale}/ngo/volunteering`}>{common("volunteering")}</Link>
      </section>
      {(!auditOk || error) ? <p className="empty-state" role="alert">{common("setupRequired")}</p> : (
        <>
          <section className="workspace-section" aria-labelledby="ngo-children-title">
            <h2 id="ngo-children-title">{t("dashboardChildren")}</h2>
            {children.length === 0 ? <p className="empty-state">{t("dashboardNoChildren")}</p> : <ul className="record-list">{children.map((child) => <li className="record-row" key={child.id}><strong>{child.public_code}</strong><span>{child.status === "foster_care" ? t("statusFosterCare") : t("statusInCare")}</span><time dateTime={child.created_at}>{new Date(child.created_at).toLocaleDateString(locale)}</time></li>)}</ul>}
            <NgoChildEntryForm />
          </section>
          <section className="workspace-section" aria-labelledby="ngo-reports-title">
            <h2 id="ngo-reports-title">{t("dashboardReports")}</h2>
            {(reportsResult.data ?? []).length === 0 ? <p className="empty-state">{t("dashboardNoReports")}</p> : <ul className="record-list">{reportsResult.data?.map((report) => <li className="record-row" key={report.id}><time dateTime={report.report_month}>{new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(new Date(`${report.report_month}T00:00:00`))}</time><span>{report.new_entries_count} · {t("newEntryCount")}</span></li>)}</ul>}
            <NgoMonthlyReportForm />
          </section>
          <section className="workspace-section" aria-labelledby="ngo-documents-title">
            <h2 id="ngo-documents-title">{t("dashboardDocuments")}</h2>
            {documents.length === 0 ? <p className="empty-state">{t("dashboardNoDocuments")}</p> : <ul className="record-list">{documents.map((document) => <li className="record-row" key={document.id}><span>{document.document_type}</span><time dateTime={document.created_at}>{new Date(document.created_at).toLocaleDateString(locale)}</time><PrivateDocumentDownloadButton documentId={document.id} table="documents" /></li>)}</ul>}
            <NgoDocumentUploadForm />
          </section>
          <section className="workspace-section" aria-labelledby="ngo-funding-title">
            <h2 id="ngo-funding-title">{t("dashboardFunding")}</h2>
            {(fundingResult.data ?? []).length === 0 ? <p className="empty-state">{t("dashboardNoFunding")}</p> : <ul className="record-list">{fundingResult.data?.map((request) => <li className="record-row" key={request.id}><span>{new Intl.NumberFormat(locale, { style: "currency", currency: "INR" }).format(request.amount_paise / 100)}</span><span>{statusLabels[request.status] ?? request.status}</span><span>{request.purpose}</span></li>)}</ul>}
            <p className="form-note">{t("fundingApproval")}</p>
            <NgoFundingForm documents={fundingDocuments} locale={locale} />
          </section>
        </>
      )}
    </main>
  );
}
