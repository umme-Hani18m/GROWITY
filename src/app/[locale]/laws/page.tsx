import { getTranslations } from "next-intl/server";
import { PageContext } from "@/components/page-context";

type Law = { title: string; date: string; plain: string };
type Term = { term: string; meaning: string };

export default async function LawsPage() {
  const t = await getTranslations("Laws");
  const items = t.raw("items") as Law[];
  const glossary = t.raw("glossary") as Term[];
  return (
    <main id="main-content" className="page-main content-width role-page">
      <PageContext pageKey="laws" />
      <section className="role-hero" aria-labelledby="laws-title"><h1 id="laws-title">{t("heading")}</h1><p className="role-lead">{t("note")}</p></section>
      <section className="laws-list"><h2>{t("heading")}</h2>{items.map((law) => <article className="law-entry" key={law.title}><h3>{law.title}</h3><p className="law-date">{law.date}</p><p>{law.plain}</p></article>)}</section>
      <section className="glossary-section"><h2>{t("heading")}</h2><div className="glossary-list">{glossary.map((entry) => <details className="glossary-item" key={entry.term}><summary>{entry.term}</summary><p>{entry.meaning}</p></details>)}</div></section>
      <p className="gazette-note">{t("verifyGazette")}</p>
    </main>
  );
}
