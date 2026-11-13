"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

export function QuickExit() {
  const t = useTranslations("Common");

  useEffect(() => {
    const returnToNeutralPage = () => {
      if (window.sessionStorage.getItem("growity-quick-exit") === "1") window.location.replace("/exit");
    };
    returnToNeutralPage();
    window.addEventListener("pageshow", returnToNeutralPage);
    return () => window.removeEventListener("pageshow", returnToNeutralPage);
  }, []);

  async function exitNow() {
    try { window.sessionStorage.setItem("growity-quick-exit", "1"); } catch { /* Continue clearing the sensitive view. */ }
    const neutral = document.createElement("main");
    neutral.className = "exit-page";
    neutral.setAttribute("aria-live", "assertive");
    neutral.textContent = t("exitComplete");
    document.body.replaceChildren(neutral);
    document.title = t("exitComplete");
    const supabase = getBrowserSupabaseClient();
    if (supabase) {
      try {
        await Promise.race([
          supabase.auth.signOut({ scope: "local" }),
          new Promise((resolve) => window.setTimeout(resolve, 800))
        ]);
      } catch {
        // Navigation remains the priority if the network is unavailable.
      }
    }
    window.location.replace("/exit");
  }

  return (
    <div className="quick-exit-wrap">
      <button className="quick-exit-button" type="button" onClick={() => { void exitNow(); }} title={t("quickExitTitle")}>
        {t("quickExit")}
      </button>
      <p>{t("privateBrowsingTip")}</p>
    </div>
  );
}
