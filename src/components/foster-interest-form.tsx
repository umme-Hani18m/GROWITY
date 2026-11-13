"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { submitFosterInterest } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";
import { TurnstileWidget } from "@/components/turnstile-widget";

export function FosterInterestForm({ siteKey }: { siteKey?: string }) {
  const t = useTranslations("Home");
  const common = useTranslations("Common");
  const [state, formAction, pending] = useActionState(submitFosterInterest, initialActionState);

  return (
    <form className="form-card foster-form" action={formAction}>
      <div className="form-grid">
        <label>
          <span>{t("fullName")} <span className="required-mark">*</span></span>
          <input type="text" name="name" autoComplete="name" maxLength={120} required />
        </label>
        <label>
          <span>{t("contactChoice")} <span className="required-mark">*</span></span>
          <input type="text" name="contact" autoComplete="off" maxLength={254} required />
        </label>
        <label className="form-wide">
          <span>{common("state")} <span className="required-mark">*</span></span>
          <input type="text" name="state" maxLength={120} placeholder={t("stateChoice")} required />
        </label>
      </div>
      <p className="form-note">{t("fosterNoFiles")}</p>
      <label className="consent-label">
        <input type="checkbox" name="consent" required />
        <span>{t("fosterFormConsent")}</span>
      </label>
      <TurnstileWidget siteKey={siteKey} label={common("captchaLabel")} />
      {!siteKey && <p className="form-note">{t("formUnavailable")}</p>}
      <button className="button button-primary" type="submit" disabled={pending || !siteKey}>
        {pending ? common("processing") : t("submitInterest")}
      </button>
      {state.status !== "idle" && (
        <p className="form-status" role="status" aria-live="polite">
          {state.status === "success" ? t("formSubmitted") : state.status === "setup" ? t("formUnavailable") : t("formError")}
        </p>
      )}
    </form>
  );
}
