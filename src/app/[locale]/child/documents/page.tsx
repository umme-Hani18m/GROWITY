import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContext } from "@/components/page-context";
import { PrivateDocumentDownloadButton } from "@/components/private-document-download-button";
import { PrivateDocumentUploadForm } from "@/components/private-document-upload-form";
import { getChildWorkspace } from "@/lib/child-workspace";

export default async function ChildDocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("Child");
  const common = await getTranslations("Common");
  const workspace = await getChildWorkspace();
  const labelFor = (type: string) => type === "education" ? t("educationRecord") : t("careRecord");

  return (
    <main id="main-content" className="page-main content-width role-page">
      <PageContext pageKey="documents" />
      <section className="role-hero" aria-labelledby="documents-title">
        
        <h1 id="documents-title">{t("documentsTitle")}</h1>
        <p className="role-lead">{common("sessionNotice")}</p>
      </section>
      {workspace ? (
        <>
          {workspace.documents.length > 0 ? <ul className="document-list">{workspace.documents.map((document) => <li className="document-row" key={document.id}>
            <div><h2>{labelFor(document.document_type)}</h2><p>{new Date(document.created_at).toLocaleDateString(locale)}</p></div>
            <PrivateDocumentDownloadButton documentId={document.id} table="documents" />
          </li>)}</ul> : <p className="empty-state">{t("noDocuments")}</p>}
          <PrivateDocumentUploadForm mode="child" />
          <p className="form-note">{t("languageSafety")}</p>
        </>
      ) : <div className="empty-state"><p>{common("sessionNotice")}</p><Link className="button button-primary" href={`/${locale}/child`}>{t("loginTitle")}</Link><p>{t("languageSafety")}</p></div>}
    </main>
  );
}
