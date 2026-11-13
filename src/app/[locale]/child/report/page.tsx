import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContext } from "@/components/page-context";
import { ChildReportForm } from "@/components/child-forms";
import { getChildWorkspace } from "@/lib/child-workspace";

export default async function ChildReportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("Child");
  const common = await getTranslations("Common");
  const workspace = await getChildWorkspace();
  const categories = t.raw("categories") as string[];
  const urgencies = t.raw("urgencies") as string[];
  const statuses = t.raw("reportStatuses") as string[];

  return (
    <main id="main-content" className="page-main content-width role-page">
      <PageContext pageKey="report" />
      <section className="role-hero" aria-labelledby="report-title">
        
        <h1 id="report-title">{t("reportTitle")}</h1>
        <p className="role-lead">{t("reportDescription")}</p>
        <p className="urgent-note">{t("urgentHelp")}</p>
      </section>
      {workspace ? <>
        <ChildReportForm />
        <section className="status-section" aria-labelledby="reports-status-title">
          <h2 id="reports-status-title">{t("statusTitle")}</h2>
          {workspace.complaints.length === 0 ? <p className="empty-state">{t("noReports")}</p> :
            <ul className="status-list">{workspace.complaints.map((complaint) => {
              const categoryIndex = ["abuse", "harassment", "neglect", "food_health", "education", "other"].indexOf(complaint.category);
              const urgencyIndex = ["normal", "serious", "emergency"].indexOf(complaint.urgency);
              const statusIndex = ["open", "reviewing", "action_taken", "closed"].indexOf(complaint.status);
              return <li key={complaint.id}>
                <div><strong>{categoryIndex >= 0 ? categories[categoryIndex] : t("reportTitle")}</strong><span>{urgencyIndex >= 0 ? urgencies[urgencyIndex] : ""}</span></div>
                <p>{t("reportStatus")}: {statusIndex >= 0 ? statuses[statusIndex] : common("status")}</p>
                <time dateTime={complaint.created_at}>{new Date(complaint.created_at).toLocaleDateString(locale)}</time>
              </li>;
            })}</ul>}
        </section>
      </> : <div className="empty-state"><p>{common("sessionNotice")}</p><Link className="button button-primary" href={`/${locale}/child`}>{t("loginTitle")}</Link></div>}
    </main>
  );
}
