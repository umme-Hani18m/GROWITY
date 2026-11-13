import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContext } from "@/components/page-context";
import { ParentOtpForm } from "@/components/parent-otp-form";
import { ParentPreferencesForm } from "@/components/parent-preferences-form";
import { DisclaimerCallout } from "@/components/disclaimer-callout";
import { getParentWorkspace } from "@/lib/parent-workspace";
import { tryReadEnvironment } from "@/lib/env";

const stepKeys = [
  "documents_submitted", "documents_verified", "in_person_check", "carings_registered", "home_study_done",
  "child_referred", "child_reserved", "pre_adoption_foster_care", "adoption_order_issued", "post_adoption_follow_up"
] as const;

export default async function ParentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("Parent");
  const common = await getTranslations("Common");
  const prefix = `/${locale}/parent`;
  const documents = t.raw("documents") as string[];
  const steps = t.raw("trackerSteps") as string[];
  const resources = t.raw("resources") as string[];
  const siteKey = tryReadEnvironment()?.TURNSTILE_SITE_KEY;
  const workspace = await getParentWorkspace();
  const tracker = workspace?.tracker ?? [];

  return (
    <main id="main-content" className="page-main content-width role-page parent-page">
      <PageContext pageKey="parent" />
      <section className="role-hero" aria-labelledby="parent-title">
        
        <h1 id="parent-title">{t("title")}</h1>
        <p className="role-lead">{t("intro")}</p>
      </section>
      <DisclaimerCallout />
      <section className="portal-access" aria-labelledby="parent-access-title">
        <div><h2 id="parent-access-title">{t("loginTitle")}</h2><p>{workspace?.application ? t("parentVerified") : t("signup")}</p></div>
        {workspace ? <p className="form-status" role="status">{common("sessionNotice")}</p> : <ParentOtpForm siteKey={siteKey} />}
      </section>
      <section className="split-section">
        <div>
          <h2>{t("documentsTitle")}</h2>
          <ul className="check-list">{documents.map((item) => <li key={item}>{item}</li>)}</ul>
          <Link className="text-button" href={`${prefix}/documents`}>{t("documentsTitle")}</Link>
        </div>
        <aside className="soft-panel"><h3>{t("visibilityTitle")}</h3><p>{t("visibilityBody")}</p></aside>
      </section>
      <section className="tracker-section"><h2>{t("trackerTitle")}</h2>
        {tracker.length > 0 ? (
          <ol className="tracker-events">
            {tracker.map((event) => {
              const index = stepKeys.indexOf(event.step as typeof stepKeys[number]);
              return <li key={event.id}>
                <time dateTime={event.step_date}>{new Date(`${event.step_date}T00:00:00`).toLocaleDateString(locale)}</time>
                <strong>{index >= 0 ? steps[index] : common("status")}</strong>
                {event.carings_registration_number && <span>{t("caringsNumber")}: {event.carings_registration_number}</span>}
                {event.referral_reference && event.step === "child_referred" && <span>{t("referralRecorded")}: {event.referral_reference}</span>}
              </li>;
            })}
          </ol>
        ) : <ol className="process-list">{steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span>{step}</li>)}</ol>}
        {workspace?.application && tracker.length === 0 && <p className="empty-state">{t("noTrackerEvents")}</p>}
      </section>
      <section className="soft-panel parent-protection"><h2>{t("noBrowse")}</h2><p>{t("preferences")}</p></section>
      {workspace?.application && <section className="preference-section"><h2>{t("preferencesTitle")}</h2><p>{t("preferences")}</p>
        <ParentPreferencesForm preferredReligion={workspace.application.preferred_religion ?? ""} preferredAgeMin={workspace.application.preferred_age_min} preferredAgeMax={workspace.application.preferred_age_max} />
      </section>}
      <section className="resource-section"><h2>{t("resourcesTitle")}</h2><ul className="resource-list">{resources.map((resource) => <li key={resource}>{resource}</li>)}</ul><Link className="button button-secondary" href={`${prefix}/resources`}>{t("resourcesTitle")}</Link></section>
      <section className="retention-panel"><h2>{t("retentionTitle")}</h2><p>{t("retentionBody")}</p></section>
      <DisclaimerCallout />
    </main>
  );
}
