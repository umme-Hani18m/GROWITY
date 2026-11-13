"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signInStaff, verifyStaffMfa, verifyStaffMfaEnrollment } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";

function MfaCodeForm({ locale }: { locale: string }) {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const [state, formAction, pending] = useActionState(verifyStaffMfa, initialActionState);

  return (
    <form className="form-card auth-form" action={formAction}>
      <p>{t("mfaPrompt")}</p>
      <label>
        <span>{t("mfaCodeLabel")}</span>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" minLength={6} maxLength={8} required />
      </label>
      <button className="button button-primary" type="submit" disabled={pending}>{pending ? common("processing") : common("continue")}</button>
      {state.status === "error" && <p className="form-status" role="alert">{common("requestFailed")}</p>}
      {state.status === "setup" && <p className="form-status" role="alert">{common("setupRequired")}</p>}
      {state.status === "verified" && <p className="form-status" role="status">{t("mfaVerified")}</p>}
      <input type="hidden" name="locale" value={locale} />
    </form>
  );
}

function MfaEnrollmentForm({ locale, factorId, qrCode, secret }: { locale: string; factorId: string; qrCode?: string; secret?: string }) {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const router = useRouter();
  const [state, formAction, pending] = useActionState(verifyStaffMfaEnrollment, initialActionState);
  useEffect(() => { if (state.status === "verified") router.replace(`/${locale}/team/dashboard`); }, [state.status, locale, router]);
  return <form className="form-card auth-form" action={formAction}>
    <h3>{t("mfaEnrollmentTitle")}</h3>
    <p>{t("mfaEnrollmentInstructions")}</p>
    {qrCode && <img className="mfa-qr" src={qrCode} alt={t("mfaEnrollmentTitle")} />}
    {secret && <p><strong>{t("mfaSecretLabel")}:</strong> <code>{secret}</code></p>}
    <input type="hidden" name="factorId" value={factorId} />
    <label><span>{t("mfaCodeLabel")}</span><input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required /></label>
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? common("processing") : t("mfaEnrollButton")}</button>
    {state.status === "error" && <p className="form-status" role="alert">{common("requestFailed")}</p>}
    {state.status === "setup" && <p className="form-status" role="alert">{common("setupRequired")}</p>}
  </form>;
}

export function StaffAuthForm({ locale }: { locale: string }) {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const router = useRouter();
  const [state, formAction, pending] = useActionState(signInStaff, initialActionState);

  useEffect(() => {
    if (state.status === "verified") router.replace(`/${locale}/team/dashboard`);
  }, [state.status, locale, router]);

  if (state.status === "mfa") return <MfaCodeForm locale={locale} />;
  if (state.status === "mfa_enroll" && state.mfaFactorId) return <MfaEnrollmentForm locale={locale} factorId={state.mfaFactorId} qrCode={state.mfaQr} secret={state.mfaSecret} />;

  return (
    <form className="form-card auth-form" action={formAction}>
      <label>
        <span>{common("email")} <span className="required-mark">*</span></span>
        <input type="email" name="email" autoComplete="username" maxLength={254} required />
      </label>
      <label>
        <span>{t("login")} <span className="required-mark">*</span></span>
        <input type="password" name="password" autoComplete="current-password" minLength={10} maxLength={256} required />
      </label>
      <button className="button button-primary" type="submit" disabled={pending}>{pending ? common("processing") : t("login")}</button>
      <p className="form-note">{t("mfa")}</p>
      {state.status === "error" && <p className="form-status" role="alert">{common("requestFailed")}</p>}
      {state.status === "setup" && <p className="form-status" role="alert">{common("setupRequired")}</p>}
    </form>
  );
}
