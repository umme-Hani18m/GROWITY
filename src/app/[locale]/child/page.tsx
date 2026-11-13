import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContext } from "@/components/page-context";
import { ChildVoiceHelp } from "@/components/child-voice-help";
import { ChildPinLoginForm } from "@/components/child-pin-login-form";
import { RoleOtpForm } from "@/components/role-otp-form";
import { ChildOnboardingRequestForm, AdultIdentityRequestForm } from "@/components/child-onboarding-request-form";
import { tryReadEnvironment } from "@/lib/env";

export default async function ChildPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("Child");
  const prefix = `/${locale}/child`;
  const siteKey = tryReadEnvironment()?.TURNSTILE_SITE_KEY;

  return (
    <main id="main-content" className="page-main content-width role-page child-portal">
      <PageContext pageKey="child" />
      <section className="role-hero child-hero" aria-labelledby="child-title">
        
        <h1 id="child-title">{t("title")}</h1>
        <p className="role-lead">{t("intro")}</p>
        <ChildVoiceHelp locale={locale} text={`${t("title")}. ${t("intro")} ${t("languageSafety")}`} />
      </section>
      <section className="portal-access child-account-setup" aria-labelledby="child-account-setup-title">
        <div>
          <h2 id="child-account-setup-title">{t("accountSetupTitle")}</h2>
          <p>{t("accountSetupIntro")}</p>
          <ol className="process-list compact-process-list">
            {(t.raw("accountSetupSteps") as string[]).map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span>{step}</li>)}
          </ol>
          <p className="form-note">{t("accountSetupHelp")}</p>
        </div>
        <a className="button button-dark" href="tel:1098">1098</a>
      </section>
      <section className="portal-access" aria-labelledby="new-account-title">
        <div><h2 id="new-account-title">{t("newAccountTitle")}</h2><p>{t("newAccountIntro")}</p></div>
        <ChildOnboardingRequestForm />
      </section>
      <section className="portal-access" aria-labelledby="child-login-title">
        <div><h2 id="child-login-title">{t("loginTitle")}</h2><p>{t("pinSource")}</p></div>
        <ChildPinLoginForm locale={locale} />
      </section>
      <section className="portal-access adult-after-care" aria-labelledby="adult-after-care-title">
        <div><h2 id="adult-after-care-title">{t("adultAfterCareTitle")}</h2><p>{t("adultAfterCareIntro")}</p><p className="form-note">{t("adultAfterCareEligibility")}</p><AdultIdentityRequestForm siteKey={siteKey} /><p className="form-note">{t("adultEmailOnly")}</p><RoleOtpForm mode="adult" locale={locale} siteKey={siteKey} /></div>
      </section>
      <nav className="child-actions" aria-label={t("title")}>
        <Link className="child-action-card" href={`${prefix}/report`}><strong>{t("reportTitle")}</strong><span>{t("reportDescription")}</span></Link>
        <Link className="child-action-card" href={`${prefix}/documents`}><strong>{t("documentsTitle")}</strong><span>{t("languageSafety")}</span></Link>
        <Link className="child-action-card" href={`${prefix}/support`}><strong>{t("supportTitle")}</strong><span>{t("supportDescription")}</span></Link>
      </nav>
      <aside className="urgent-callout"><h2>{t("urgentHelp")}</h2><a className="button button-dark" href="tel:1098">1098</a></aside>
    </main>
  );
}
