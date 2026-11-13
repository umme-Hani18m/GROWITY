import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContext } from "@/components/page-context";
import { getChildWorkspace } from "@/lib/child-workspace";

export default async function ChildDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("Child");
  const common = await getTranslations("Common");
  const workspace = await getChildWorkspace();
  const prefix = `/${locale}/child`;
  return <main id="main-content" className="page-main content-width role-page">
    <PageContext pageKey="child" />
    <section className="role-hero" aria-labelledby="child-dashboard-title">
      
      <h1 id="child-dashboard-title">{t("dashboardTitle")}</h1>
      <p className="role-lead">{workspace ? t("dashboardIntro") : common("sessionNotice")}</p>
    </section>
    {workspace ? <>
      <section className="summary-grid" aria-label={t("dashboardTitle")}>
        <article className="summary-card"><span>{t("dashboardReports")}</span><strong>{workspace.complaints.length}</strong></article>
        <article className="summary-card"><span>{t("dashboardDocuments")}</span><strong>{workspace.documents.length}</strong></article>
        <article className="summary-card"><span>{t("dashboardSupport")}</span><strong>{workspace.supportRequests.length}</strong></article>
      </section>
      <nav className="child-actions" aria-label={t("dashboardTitle")}>
        <Link className="child-action-card" href={`${prefix}/report`}><strong>{t("reportTitle")}</strong><span>{t("reportDescription")}</span></Link>
        <Link className="child-action-card" href={`${prefix}/documents`}><strong>{t("documentsTitle")}</strong><span>{t("languageSafety")}</span></Link>
        <Link className="child-action-card" href={`${prefix}/support`}><strong>{t("supportTitle")}</strong><span>{t("supportDescription")}</span></Link>
      </nav>
    </> : <div className="empty-state"><p>{common("sessionNotice")}</p><Link className="button button-primary" href={prefix}>{t("dashboardReturn")}</Link></div>}
  </main>;
}
