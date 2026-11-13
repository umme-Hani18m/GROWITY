import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContext } from "@/components/page-context";
import { Slideshow } from "@/components/slideshow";
import { FosterInterestForm } from "@/components/foster-interest-form";
import { tryReadEnvironment } from "@/lib/env";

type Audience = {
  title: string;
  description: string;
  href: string;
  openLabel: string;
  details: string[];
  fosterInterest?: boolean;
};

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("Home");
  const common = await getTranslations("Common");
  const audiences = t.raw("audiences") as Audience[];
  const prefix = `/${locale}`;
  const siteKey = tryReadEnvironment()?.TURNSTILE_SITE_KEY;

  return (
    <main id="main-content" className="page-main home-main">
      <section className="home-demo-notice" aria-label={t("demoNotice")}>
        <p className="sr-only">{t("demoNotice")}</p>
        <div className="home-demo-track" aria-hidden="true">
          <span>{t("demoNotice")}</span><span>{t("demoNotice")}</span>
        </div>
      </section>
      <section className="home-intro content-width" aria-labelledby="home-title">
        <div className="home-intro-copy">
          
          <h1 id="home-title">{t("title")}</h1>
          <p className="home-lead">{t("intro")}</p>
          <Link className="button button-secondary" href={`${prefix}/help`}>{common("openHelp")}</Link>
        </div>
        <Slideshow />
      </section>

      <div className="content-width">
        <PageContext pageKey="home" />
      </div>

      <div className="content-width home-content">
        <section className="audience-section" aria-labelledby="audience-title">
          <div className="section-heading-row">
            
            <h2 id="audience-title">{t("audienceTitle")}</h2>
          </div>
          <div className="audience-list">
            {audiences.map((audience) => (
              <article className="audience-card" key={audience.href}>
                <div className="audience-card-heading">
                  
                  <div>
                    <h3>{audience.title}</h3>
                    <p>{audience.description}</p>
                  </div>
                </div>
                <details className="audience-details">
                  <summary>{common("learnMore")}</summary>
                  <ul className="role-detail-list">
                    {audience.details.map((detail) => <li key={detail}>{detail}</li>)}
                  </ul>
                  {audience.fosterInterest && (
                    <div className="foster-interest-inline">
                      <div className="foster-interest-card">
                        <h4>{t("fosterInterestTitle")}</h4>
                        <p>{t("fosterInterestIntro")}</p>
                        <FosterInterestForm siteKey={siteKey} />
                      </div>
                    </div>
                  )}
                </details>
                <Link className="button button-secondary audience-portal-link" href={`${prefix}${audience.href}`}>
                  {audience.openLabel}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="home-law-teaser" aria-label={common("laws")}>
          <p>{t("lawTeaser")}</p>
          <Link className="text-button" href={`${prefix}/laws`}>{common("laws")}</Link>
        </section>

        <section className="helpline-callout" aria-labelledby="callout-title">
          <div>
            
            <h2 id="callout-title">{t("calloutTitle")}</h2>
            <p>{t("calloutBody")}</p>
          </div>
          <a className="button button-dark" href="tel:1098">1098</a>
        </section>
        <p className="licensed-photo-note">{t("verifiedNote")}</p>
        <section hidden aria-hidden="true"><h2>{t("partnersPlaceholder")}</h2></section>
      </div>
    </main>
  );
}
