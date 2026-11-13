import { getTranslations } from "next-intl/server";
import { PageContext } from "@/components/page-context";
import { DisclaimerCallout } from "@/components/disclaimer-callout";
import { PrivateDocumentDownloadButton } from "@/components/private-document-download-button";
import { getParentWorkspace } from "@/lib/parent-workspace";

export default async function ParentArchivePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("Parent");
  const common = await getTranslations("Common");
  const workspace = await getParentWorkspace();
  const order = workspace?.tracker.find((event) => event.step === "adoption_order_issued" && event.adoption_order_number && event.adoption_order_date);
  const archiveDocuments = order ? (workspace?.documents.filter((document) => document.document_type === "adoption_order" || document.document_type === "official_photo") ?? []) : [];

  return (
    <main id="main-content" className="page-main content-width role-page parent-page">
      <PageContext pageKey="parentArchive" />
      <section className="role-hero" aria-labelledby="archive-title">
        <h1 id="archive-title">{t("archiveTitle")}</h1>
        <p className="role-lead">{order ? `${t("orderRecorded")}: ${order.adoption_order_number} · ${order.adoption_order_date}` : t("archiveLocked")}</p>
      </section>
      <DisclaimerCallout />
      {order ? archiveDocuments.length > 0 ? (
        <ul className="document-list">{archiveDocuments.map((document) => <li className="document-row" key={document.id}>
          <div><h2>{document.document_type === "adoption_order" ? t("orderDocument") : t("officialPhoto")}</h2><p>{new Date(document.created_at).toLocaleDateString(locale)}</p></div>
          <PrivateDocumentDownloadButton documentId={document.id} table="parent_documents" />
        </li>)}</ul>
      ) : <p className="empty-state">{common("noRecords")}</p> : <div className="soft-panel"><p>{t("archiveLocked")}</p><p>{common("sessionNotice")}</p></div>}
      <DisclaimerCallout />
    </main>
  );
}
