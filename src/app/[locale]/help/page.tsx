import { getTranslations } from "next-intl/server";
import { PageContext } from "@/components/page-context";

type Question = { question: string; answer: string };

export default async function HelpPage() {
  const t = await getTranslations("Help");
  const common = await getTranslations("Common");
  const questions = t.raw("questions") as Question[];
  return (
    <main id="main-content" className="page-main content-width role-page">
      <PageContext pageKey="help" />
      <section className="role-hero" aria-labelledby="help-title"><h1 id="help-title">{t("title")}</h1><p className="role-lead">{t("intro")}</p><a className="button button-dark" href="tel:1098">1098</a></section>
      <section className="faq-section"><h2>{t("faqTitle")}</h2><div className="faq-list">{questions.map((item) => <details className="faq-item" key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>
      <section className="soft-panel"><h2>{t("contactTitle")}</h2><p>{t("contactBody")}</p></section>
    </main>
  );
}
