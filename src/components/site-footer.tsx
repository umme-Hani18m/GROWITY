"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function SiteFooter({ locale }: { locale: string }) {
  const t = useTranslations("Common");
  const prefix = `/${locale}`;

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-intro">
          <Link className="footer-brand" href={prefix}>{t("brand")}</Link>
          <p>{t("footerNote")}</p>
          <p className="footer-helpline">{t("childline")}</p>
        </div>
        <nav className="footer-links" aria-label={t("help")}>
          <Link href={`${prefix}/policies/terms`}>{t("terms")}</Link>
          <Link href={`${prefix}/policies/privacy`}>{t("privacy")}</Link>
          <Link href={`${prefix}/policies/child-safety`}>{t("childSafety")}</Link>
          <Link href={`${prefix}/help`}>{t("contact")}</Link>
        </nav>
        <p className="footer-disclaimer">{t("disclaimer")}</p>
      </div>
    </footer>
  );
}
