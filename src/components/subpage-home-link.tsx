"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export function SubpageHomeLink({ locale }: { locale: string }) {
  const pathname = usePathname();
  const t = useTranslations("Common");
  const homePath = `/${locale}`;

  if (pathname === homePath || pathname === `${homePath}/`) return null;

  return (
    <div className="subpage-home-wrap">
      <div className="content-width">
        <Link className="subpage-home-link" href={homePath} aria-label={t("home")}>
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M3 10.5 12 3l9 7.5v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          <span>{t("home")}</span>
        </Link>
      </div>
    </div>
  );
}
