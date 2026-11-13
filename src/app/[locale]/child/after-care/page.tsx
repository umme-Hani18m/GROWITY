import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContext } from "@/components/page-context";
import { AfterCareRecordView } from "@/components/after-care-record-view";
import { AfterCareDataControls } from "@/components/after-care-data-controls";
import { getAuthenticatedProfile } from "@/lib/auth";

export default async function AfterCarePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const child = await getTranslations("Child");
  const parent = await getTranslations("Parent");
  const common = await getTranslations("Common");
  const adult = await getAuthenticatedProfile("adult_after_care");

  return (
    <main id="main-content" className="page-main content-width role-page child-portal">
      <PageContext pageKey="afterCare" />
      <section className="role-hero" aria-labelledby="after-care-title">
        <h1 id="after-care-title">{child("adultAfterCareTitle")}</h1>
        <p className="role-lead">{child("adultAfterCareIntro")}</p>
      </section>
      <section className="retention-panel"><h2>{parent("retentionTitle")}</h2><p>{parent("retentionBody")}</p></section>
      {adult ? <>
        <AfterCareRecordView supabase={adult.supabase} userId={adult.user.id} />
        <AfterCareDataControls />
      </> : <div className="empty-state"><p>{common("sessionNotice")}</p><Link className="button button-primary" href={`/${locale}/child`}>{child("adultAfterCareTitle")}</Link></div>}
    </main>
  );
}
