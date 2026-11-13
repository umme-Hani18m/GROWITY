import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import en from "../../messages/en.json";

export type PageInfoKey = keyof typeof en.PageInfo;
type PolicySlug = "terms" | "privacy" | "child-safety" | "parent-terms" | "ngo-terms" | "staff-code" | "complaints" | "retention" | "cookies" | "disclaimer";

const lawsByPage: Partial<Record<PageInfoKey, number[]>> = {
  child: [2, 6, 7],
  report: [2, 6],
  documents: [2, 7],
  support: [2, 5],
  parent: [2, 3, 4],
  parentDocuments: [2, 4, 7],
  parentArchive: [2, 3, 4],
  afterCare: [2, 7],
  parentResources: [2, 4],
  ngo: [2, 4, 5, 7],
  volunteering: [2, 5, 6],
  team: [2, 6, 7]
};

const lawsByPolicy: Record<PolicySlug, number[]> = {
  terms: [2, 4],
  privacy: [7],
  "child-safety": [2, 6],
  "parent-terms": [2, 3, 4],
  "ngo-terms": [2, 4, 5],
  "staff-code": [2, 6, 7],
  complaints: [2, 6],
  retention: [7],
  cookies: [7],
  disclaimer: []
};

export async function PageContext({ pageKey, policySlug }: { pageKey: PageInfoKey; policySlug?: PolicySlug }) {
  const page = await getTranslations("PageInfo");
  const common = await getTranslations("Common");
  const laws = await getTranslations("Laws");
  const locale = await getLocale();
  const items = laws.raw("items") as Array<{ title: string; date: string; plain: string }>;
  const lawIndexes = policySlug ? lawsByPolicy[policySlug] : (lawsByPage[pageKey] ?? []);
  const relevantLaws = lawIndexes.map((index) => items[index - 1]).filter(Boolean);
  const lawsHref = `/${locale}/laws`;

  return (
    <aside className={`page-context ${relevantLaws.length ? "page-context-with-laws" : "page-context-no-laws"}`}>
      <details className="what-box">
        <summary>{common("whatIsThis")}</summary>
        <p>{page(pageKey)}</p>
      </details>
      {relevantLaws.length > 0 && (
        <details className="law-box">
          <summary>{common("lawsBehind")}</summary>
          <ul>
            {relevantLaws.map((law) => (
              <li key={law.title}>
                <Link href={lawsHref}>{law.title}</Link>
                <span className="law-date">{law.date}</span>
              </li>
            ))}
          </ul>
          <Link className="law-reference-link" href={lawsHref}>{common("laws")}</Link>
        </details>
      )}
    </aside>
  );
}
