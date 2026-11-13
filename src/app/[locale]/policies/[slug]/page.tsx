import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageContext } from "@/components/page-context";
import { DisclaimerCallout } from "@/components/disclaimer-callout";

const policySlugs = ["terms", "privacy", "child-safety", "parent-terms", "ngo-terms", "staff-code", "complaints", "retention", "cookies", "disclaimer"] as const;
type PolicySlug = (typeof policySlugs)[number];

export default async function PolicyPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params;
  if (!policySlugs.includes(slug as PolicySlug)) notFound();
  const policy = await getTranslations("Policies");
  const common = await getTranslations("Common");
  const policyKey = slug as PolicySlug;

  return (
    <main id="main-content" className="page-main content-width role-page">
      <PageContext pageKey="policy" policySlug={policyKey} />
      <section className="role-hero" aria-labelledby="policy-title">
        
        <h1 id="policy-title">{policy(`titles.${policyKey}`)}</h1>
        <p className="role-lead">{policy("publicNotice")}</p>
      </section>
      <article className="policy-copy"><p>{policy(policyKey)}</p></article>
      {policyKey.startsWith("parent-") && <DisclaimerCallout />}
    </main>
  );
}
