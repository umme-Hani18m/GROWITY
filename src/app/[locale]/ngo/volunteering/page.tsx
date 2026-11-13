import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContext } from "@/components/page-context";

export default async function VolunteeringPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("Volunteering");
  const activities = t.raw("activities") as string[];
  const safeguards = t.raw("safeguards") as string[];

  return (
    <main id="main-content" className="page-main content-width role-page">
      <PageContext pageKey="volunteering" />
      <section className="role-hero" aria-labelledby="volunteer-title">
        
        <h1 id="volunteer-title">{t("title")}</h1>
        <p className="role-lead">{t("intro")}</p>
      </section>
      <section className="volunteer-section" aria-labelledby="volunteer-eligibility-title">
        <h2 id="volunteer-eligibility-title">{t("eligibilityTitle")}</h2>
        <p>{t("eligibility")}</p>
      </section>
      <section className="volunteer-section" aria-labelledby="volunteer-activities-title">
        <h2 id="volunteer-activities-title">{t("activitiesTitle")}</h2>
        <ul className="check-list">{activities.map((activity) => <li key={activity}>{activity}</li>)}</ul>
      </section>
      <section className="volunteer-section volunteer-safeguards" aria-labelledby="volunteer-safety-title">
        <h2 id="volunteer-safety-title">{t("safetyTitle")}</h2>
        <ul className="check-list">{safeguards.map((safeguard) => <li key={safeguard}>{safeguard}</li>)}</ul>
      </section>
      <section className="volunteer-recognition" aria-labelledby="volunteer-recognition-title">
        <h2 id="volunteer-recognition-title">{t("recognitionTitle")}</h2>
        <p>{t("recognition")}</p>
        <p className="form-note">{t("academicNote")}</p>
      </section>
      <section className="volunteer-start" aria-labelledby="volunteer-start-title">
        <h2 id="volunteer-start-title">{t("nextTitle")}</h2>
        <p>{t("next")}</p>
        <div className="volunteer-links">
          <Link className="button button-primary" href={`/${locale}/ngo`}>{t("directoryLink")}</Link>
          <Link className="button button-secondary" href={`/${locale}/help`}>{t("helpLink")}</Link>
        </div>
      </section>
    </main>
  );
}
