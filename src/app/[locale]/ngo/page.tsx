import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContext } from "@/components/page-context";
import { createUserClient } from "@/lib/supabase/server";
import { readEnvironment, hasSupabaseEnvironment } from "@/lib/env";
import { RoleOtpForm } from "@/components/role-otp-form";
import { tryReadEnvironment } from "@/lib/env";

type VerifiedNgo = { id: string; display_name: string; recognition_type: "saa" | "cci"; recognition_number: string; recognition_date: string; state: string };

export default async function NgoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("NGO");
  const volunteer = await getTranslations("Volunteering");
  const siteKey = tryReadEnvironment()?.TURNSTILE_SITE_KEY;
  const features = t.raw("features") as string[];
  let organizations: VerifiedNgo[] = [];
  try {
    const env = readEnvironment();
    if (hasSupabaseEnvironment(env)) {
      const supabase = await createUserClient();
      const { data } = await supabase.from("verified_ngos_public").select("id, display_name, recognition_type, recognition_number, recognition_date, state").order("display_name");
      organizations = (data ?? []) as VerifiedNgo[];
    }
  } catch {
    organizations = [];
  }

  return (
    <main id="main-content" className="page-main content-width role-page">
      <PageContext pageKey="ngo" />
      <section className="role-hero" aria-labelledby="ngo-title"><h1 id="ngo-title">{t("title")}</h1><p className="role-lead">{t("intro")}</p></section>
      <section className="directory-section"><h2>{t("directoryTitle")}</h2><p>{t("directoryIntro")}</p>
        {organizations.length === 0 ? <p className="empty-state">{t("emptyDirectory")}</p> : (
          <ul className="ngo-list">{organizations.map((ngo) => (
            <li className="ngo-card" key={ngo.id}>
              <span className="verified-badge">{ngo.recognition_type === "saa" ? t("saaBadge") : t("cciBadge")}</span>
              <h3>{ngo.display_name}</h3>
              <p>{ngo.recognition_number}</p>
              <p>{ngo.recognition_date} · {ngo.state}</p>
            </li>
          ))}</ul>
        )}
      </section>
      <section className="volunteer-entry" aria-labelledby="volunteer-entry-title">
        <div><h2 id="volunteer-entry-title">{volunteer("title")}</h2><p>{volunteer("intro")}</p></div>
        <Link className="button button-secondary" href={`/${locale}/ngo/volunteering`}>{volunteer("directoryLink")}</Link>
      </section>
      <section className="portal-access"><div><h2>{t("loginTitle")}</h2><p>{t("verificationRequired")}</p></div><RoleOtpForm mode="ngo" locale={locale} siteKey={siteKey} /></section>
      <section className="feature-panel"><h2>{t("featuresTitle")}</h2><ul className="check-list">{features.map((feature) => <li key={feature}>{feature}</li>)}</ul><p>{t("privacyWarning")}</p><p>{t("fundingApproval")}</p></section>
    </main>
  );
}
