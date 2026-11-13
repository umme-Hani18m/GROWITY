import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContext } from "@/components/page-context";
import { DisclaimerCallout } from "@/components/disclaimer-callout";
import { PrivateDocumentUploadForm } from "@/components/private-document-upload-form";
import { PrivateDocumentDownloadButton } from "@/components/private-document-download-button";
import { getParentWorkspace } from "@/lib/parent-workspace";

const documentTypes = ["identity", "address", "income", "medical", "police_verification"];

export default async function ParentDocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("Parent");
  const common = await getTranslations("Common");
  const workspace = await getParentWorkspace();
  const labels = t.raw("documents") as string[];
  const visibleDocuments = workspace?.documents.filter((document) => documentTypes.includes(document.document_type)) ?? [];

  return (
    <main id="main-content" className="page-main content-width role-page parent-page">
      <PageContext pageKey="parentDocuments" />
      <section className="role-hero" aria-labelledby="parent-documents-title">
        
        <h1 id="parent-documents-title">{t("documentsTitle")}</h1>
        <p className="role-lead">{t("visibilityBody")}</p>
      </section>
      <DisclaimerCallout />
      <ul className="check-list checklist-panel">{labels.map((item) => <li key={item}>{item}</li>)}</ul>
      <div className="soft-panel"><h2>{t("visibilityTitle")}</h2><p>{t("visibilityBody")}</p></div>
      {workspace?.application ? (
        <>
          {visibleDocuments.length > 0 ? <ul className="document-list">{visibleDocuments.map((document) => {
            const typeIndex = documentTypes.indexOf(document.document_type);
            const statusText = document.verification_status === "verified" ? t("documentVerified") : document.verification_status === "rejected" ? t("documentRejected") : t("documentPending");
            return <li className="document-row" key={document.id}>
              <div><h3>{labels[typeIndex] ?? t("documentsTitle")}</h3><p>{statusText} · {new Date(document.created_at).toLocaleDateString(locale)}</p></div>
              <PrivateDocumentDownloadButton documentId={document.id} table="parent_documents" />
            </li>;
          })}</ul> : <p className="empty-state">{t("noDocuments")}</p>}
          <PrivateDocumentUploadForm mode="parent" />
          <Link className="text-button" href={`/${locale}/parent/archive`}>{t("archiveTitle")}</Link>
        </>
      ) : <p className="empty-state">{common("sessionNotice")} <Link href={`/${locale}/parent`}>{t("loginTitle")}</Link></p>}
      <DisclaimerCallout />
    </main>
  );
}
