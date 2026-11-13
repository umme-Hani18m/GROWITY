import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContext } from "@/components/page-context";
import { ChildSupportForm } from "@/components/child-forms";
import { getChildWorkspace } from "@/lib/child-workspace";

export default async function ChildSupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("Child");
  const common = await getTranslations("Common");
  const workspace = await getChildWorkspace();
  const topics = t.raw("supportTopics") as string[];
  const statuses = t.raw("supportStatuses") as string[];

  return (
    <main id="main-content" className="page-main content-width role-page">
      <PageContext pageKey="support" />
      <section className="role-hero" aria-labelledby="support-title">
        
        <h1 id="support-title">{t("supportTitle")}</h1>
        <p className="role-lead">{t("supportDescription")}</p>
      </section>
      {workspace ? <>
        <ChildSupportForm />
        <section className="status-section" aria-labelledby="support-status-title">
          <h2 id="support-status-title">{t("supportStatusTitle")}</h2>
          {workspace.supportRequests.length === 0 ? <p className="empty-state">{t("noSupportRequests")}</p> :
            <ul className="status-list">{workspace.supportRequests.map((request) => {
              const topicIndex = ["foster_care", "other_support"].indexOf(request.topic);
              const statusIndex = ["open", "reviewing", "resolved", "closed"].indexOf(request.status);
              return <li key={request.id}>
                <div><strong>{topicIndex >= 0 ? topics[topicIndex] : t("supportTitle")}</strong></div>
                <p>{t("reportStatus")}: {statusIndex >= 0 ? statuses[statusIndex] : common("status")}</p>
                <time dateTime={request.created_at}>{new Date(request.created_at).toLocaleDateString(locale)}</time>
              </li>;
            })}</ul>}
        </section>
      </> : <div className="empty-state"><p>{common("sessionNotice")}</p><Link className="button button-primary" href={`/${locale}/child`}>{t("loginTitle")}</Link></div>}
    </main>
  );
}
