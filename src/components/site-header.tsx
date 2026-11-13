"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

export function SiteHeader({ locale }: { locale: string }) {
  const t = useTranslations("Common");
  const otherLocale = locale === "en" ? "hi" : "en";
  const otherLabel = locale === "en" ? t("languageHindi") : t("languageEnglish");
  const prefix = `/${locale}`;
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!toolsRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const closeMenus = () => {
    setMenuOpen(false);
    setMobileOpen(false);
  };

  return (
    <header className="site-header">
      <div className="helpline-bar">
        <span>{t("childline")}</span>
      </div>
      <div className="header-inner">
        <Link className="wordmark" href={prefix} aria-label={t("brand")} onClick={closeMenus}>
          <img className="wordmark-mark" src="/growity-mark.svg" alt="" width="34" height="34" />
          <span>{t("brand")}</span>
        </Link>
        <button className="mobile-menu-toggle" type="button" aria-expanded={mobileOpen} aria-controls="site-header-tools" onClick={() => setMobileOpen((open) => !open)}>
          <span className="sr-only">{mobileOpen ? t("close") : t("menu")}</span>
          <span aria-hidden="true">{mobileOpen ? "×" : "☰"}</span>
        </button>
        <div id="site-header-tools" className={`header-tools ${mobileOpen ? "is-open" : ""}`} ref={toolsRef}>
          <Link className="home-link" href={prefix} aria-label={t("home")} onClick={closeMenus}>
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M3 10.5 12 3l9 7.5v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
            <span>{t("home")}</span>
          </Link>
          <Link className="help-link" href={`${prefix}/help`} onClick={closeMenus}>{t("help")}</Link>
          <span className="language-label">{t("language")}:</span>
          <Link className="language-link" href={`/${otherLocale}`} lang={otherLocale} onClick={closeMenus}>{otherLabel}</Link>
          <div className="get-started">
            <button className="get-started-button" type="button" aria-expanded={menuOpen} aria-haspopup="menu" onClick={() => setMenuOpen((open) => !open)}>
              {t("getStarted")} <span aria-hidden="true">⌄</span>
            </button>
            {menuOpen && <div className="get-started-menu" role="menu">
              <Link role="menuitem" href={`${prefix}/child`} onClick={closeMenus}>{t("startChild")}</Link>
              <Link role="menuitem" href={`${prefix}/parent`} onClick={closeMenus}>{t("startParent")}</Link>
              <Link role="menuitem" href={`${prefix}/ngo`} onClick={closeMenus}>{t("startNgo")}</Link>
              <Link role="menuitem" href={`${prefix}/team`} onClick={closeMenus}>{t("startTeam")}</Link>
            </div>}
          </div>
        </div>
      </div>
    </header>
  );
}
