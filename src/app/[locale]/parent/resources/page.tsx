import { getTranslations } from "next-intl/server";
import { PageContext } from "@/components/page-context";
import { DisclaimerCallout } from "@/components/disclaimer-callout";

export default async function ParentResourcesPage() {
  const t = await getTranslations("Parent");
  const resources = t.raw("resources") as string[];
  return (
    <main id="main-content" className="page-main content-width role-page parent-page">
      <PageContext pageKey="parentResources" />
      <section className="role-hero" aria-labelledby="resource-title">
        
        <h1 id="resource-title">{t("resourcesTitle")}</h1>
        <p className="role-lead">{t("intro")}</p>
      </section>
      <DisclaimerCallout />
      <ul className="resource-list resource-list-large">{resources.map((item) => <li key={item}>{item}</li>)}</ul>
      <p className="legal-note">{t("noBrowse")}</p>
      <DisclaimerCallout />
    </main>
  );
}
