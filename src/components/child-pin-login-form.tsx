"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signInChild } from "@/app/auth-actions";
import { initialActionState } from "@/lib/action-state";

export function ChildPinLoginForm({ locale }: { locale: string }) {
  const t = useTranslations("Child");
  const common = useTranslations("Common");
  const router = useRouter();
  const [state, formAction, pending] = useActionState(signInChild, initialActionState);

  useEffect(() => {
    if (state.status === "verified") router.replace(`/${locale}/child/dashboard`);
  }, [state.status, locale, router]);

  return (
    <form className="form-card auth-form" action={formAction}>
      <label>
        <span>{t("codeLabel")}</span>
        <input name="publicCode" autoCapitalize="characters" autoComplete="off" minLength={4} maxLength={32} required />
      </label>
      <label>
        <span>{t("pinLabel")}</span>
        <input name="pin" type="password" inputMode="numeric" autoComplete="current-password" pattern="(?:[0-9]{4}|[0-9]{6})" minLength={4} maxLength={6} required />
      </label>
      <button className="button button-primary" type="submit" disabled={pending}>{pending ? common("processing") : t("loginButton")}</button>
      <p className="form-note">{t("pinReset")}</p>
      {state.status === "error" && <p className="form-status" role="alert">{common("requestFailed")}</p>}
      {state.status === "setup" && <p className="form-status" role="alert">{common("setupRequired")}</p>}
    </form>
  );
}
