"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { requestAdultAfterCareOtp, requestNgoEmailOtp, verifyAdultAfterCareOtp, verifyNgoEmailOtp } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";
import { TurnstileWidget } from "@/components/turnstile-widget";

type RoleOtpFormProps = { mode: "ngo" | "adult"; locale: string; siteKey?: string };

function ErrorMessage({ code, fallback }: { code?: string; fallback: string }) {
  const common = useTranslations("Common");
  if (code === "wrong_code") return <p className="form-status" role="alert">{common("otpWrong")}</p>;
  if (code === "expired_code") return <p className="form-status" role="alert">{common("otpExpired")}</p>;
  if (code === "too_many_tries") return <p className="form-status" role="alert">{common("otpTooMany")}</p>;
  return <p className="form-status" role="alert">{fallback}</p>;
}

export function RoleOtpForm({ mode, locale, siteKey }: RoleOtpFormProps) {
  const t = useTranslations(mode === "ngo" ? "NGO" : "Child");
  const common = useTranslations("Common");
  const router = useRouter();
  const requestActionFunction = mode === "ngo" ? requestNgoEmailOtp : requestAdultAfterCareOtp;
  const verifyActionFunction = mode === "ngo" ? verifyNgoEmailOtp : verifyAdultAfterCareOtp;
  const [requestState, requestAction, requestPending] = useActionState(requestActionFunction, initialActionState);
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyActionFunction, initialActionState);
  const [resendSeconds, setResendSeconds] = useState(0);
  const email = requestState.email;

  useEffect(() => {
    if (requestState.status === "sent") setResendSeconds(30);
  }, [requestState]);
  useEffect(() => {
    if (!resendSeconds) return;
    const timer = window.setInterval(() => setResendSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);
  useEffect(() => {
    if (verifyState.status === "verified") {
      const destination = mode === "ngo" ? `/${locale}/ngo/dashboard` : `/${locale}/child/after-care`;
      router.replace(destination);
      router.refresh();
    }
  }, [verifyState.status, mode, locale, router]);

  if (requestState.status === "neutral") return <p className="form-status" role="status">{t("identityRequestReceived")}</p>;
  if (requestState.status === "sent" && email) {
    return <form className="form-card auth-form" action={verifyAction}>
      <p>{common("otpPrompt", { email })}</p>
      <input type="hidden" name="email" value={email} />
      <label><span>{common("otpCode")} <span className="required-mark">*</span></span><input name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" minLength={6} maxLength={8} required /></label>
      <label className="consent-label"><input type="checkbox" name="consent" required /><span>{mode === "ngo" ? t("onboardingConsent") : t("adultAfterCareConsent")}</span></label>
      <TurnstileWidget siteKey={siteKey} label={common("captchaLabel")} />
      <div className="otp-actions">
        <button className="button button-primary" type="submit" disabled={verifyPending}>{verifyPending ? common("processing") : common("verifyCode")}</button>
        <button className="button button-secondary" type="submit" formAction={requestAction} disabled={requestPending || resendSeconds > 0}>{resendSeconds > 0 ? common("resendIn", { seconds: resendSeconds }) : common("resendCode")}</button>
      </div>
      <input type="hidden" name="captchaToken" value="" />
      {verifyState.status === "error" && <ErrorMessage code={verifyState.errorCode} fallback={common("otpVerifyFailed")} />}
      {verifyState.status === "setup" && <p className="form-status" role="alert">{common("emailSetupRequired")}</p>}
    </form>;
  }

  return <form className="form-card auth-form" action={requestAction}>
    <label><span>{common("email")} <span className="required-mark">*</span></span><input type="email" name="email" autoComplete="email" maxLength={254} required /></label>
    <label className="consent-label"><input type="checkbox" name="consent" required /><span>{mode === "ngo" ? t("onboardingConsent") : t("adultAfterCareConsent")}</span></label>
    <TurnstileWidget siteKey={siteKey} label={common("captchaLabel")} />
    <button className="button button-primary" type="submit" disabled={requestPending}>{requestPending ? common("processing") : t("emailOtp")}</button>
    {requestState.status === "error" && <ErrorMessage code={requestState.errorCode} fallback={common("otpDeliveryFailed")} />}
    {requestState.status === "setup" && <p className="form-status" role="alert">{common("emailSetupRequired")}</p>}
  </form>;
}
