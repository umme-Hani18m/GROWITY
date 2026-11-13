import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { localeDirection } from "@/i18n/languages";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SubpageHomeLink } from "@/components/subpage-home-link";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Common" });
  return { title: t("brand") };
}

export default async function LocaleLayout({
  children,
  params
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [messages, common] = await Promise.all([getMessages(), getTranslations("Common")]);
  const direction = localeDirection(locale);

  return (
    <NextIntlClientProvider messages={messages}>
      <div lang={locale} dir={direction} className="locale-shell">
        <a className="skip-link" href="#main-content">{common("skipToContent")}</a>
        <SiteHeader locale={locale} />
        <SubpageHomeLink locale={locale} />
        {children}
        <SiteFooter locale={locale} />
      </div>
    </NextIntlClientProvider>
  );
}
