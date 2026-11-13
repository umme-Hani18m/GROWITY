import { getTranslations } from "next-intl/server";

export async function DisclaimerCallout() {
  const t = await getTranslations("Common");
  return <aside className="disclaimer-callout" aria-label={t("disclaimer")}>{t("disclaimer")}</aside>;
}
