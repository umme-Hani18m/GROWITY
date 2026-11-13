"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { requestChildAccount, requestAdultIdentity } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";
import { TurnstileWidget } from "@/components/turnstile-widget";

function FormFeedback({ status, successText }: { status: string; successText: string }) {
  const common = useTranslations("Common");
  if (status === "success" || status === "neutral") return <p className="form-status" role="status">{successText}</p>;
  if (status === "setup") return <p className="form-status" role="alert">{common("setupRequired")}</p>;
  if (status === "error") return <p className="form-status" role="alert">{common("requestFailed")}</p>;
  return null;
}

export function ChildOnboardingRequestForm() {
  const t = useTranslations("Child");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(requestChildAccount, initialActionState);
  if (state.status === "success") return <p className="form-status" role="status">{t("requestReceived")}</p>;
  return <form className="form-card auth-form" action={action}>
    <label>
      <span>{t("nicknameLabel")} <span className="required-mark">*</span></span>
      <input name="preferredName" autoComplete="given-name" maxLength={80} required />
    </label>
    <fieldset className="radio-group">
      <legend>{t("ageRangeLabel")} <span className="required-mark">*</span></legend>
      <label className="radio-option"><input type="radio" name="ageRange" value="under_13" required /> <span>{t("ageUnder13")}</span></label>
      <label className="radio-option"><input type="radio" name="ageRange" value="13_to_17" required /> <span>{t("age13to17")}</span></label>
    </fieldset>
    <label>
      <span>{common("state")} <span className="required-mark">*</span></span>
      <input name="state" autoComplete="address-level1" maxLength={120} required />
    </label>
    <label>
      <span>{t("safeContactLabel")}</span>
      <input name="safeContact" autoComplete="email" maxLength={254} />
      <span className="form-note">{t("safeContactHelp")}</span>
    </label>
    <label className="consent-label"><input type="checkbox" name="guardianOrCaseworkerKnown" required /><span>{t("caseworkerKnownLabel")}</span></label>
    <label className="consent-label"><input type="checkbox" name="consent" required /><span>{t("newAccountConsent")}</span></label>
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? common("processing") : t("requestAccount")}</button>
    <FormFeedback status={state.status} successText={t("requestReceived")} />
  </form>;
}

export function AdultIdentityRequestForm({ siteKey }: { siteKey?: string }) {
  const t = useTranslations("Child");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(requestAdultIdentity, initialActionState);
  if (state.status === "neutral") return <p className="form-status" role="status">{t("identityRequestReceived")}</p>;
  return <form className="form-card auth-form" action={action}>
    <fieldset className="radio-group">
      <legend>{t("adultPathwayTitle")} <span className="required-mark">*</span></legend>
      <label className="radio-option"><input type="radio" name="pathway" value="in_care_18_plus" required /> <span>{t("adultPathwayInCare")}</span></label>
      <label className="radio-option"><input type="radio" name="pathway" value="adopted_18_plus" required /> <span>{t("adultPathwayAdopted")}</span></label>
    </fieldset>
    <label><span>{common("email")} <span className="required-mark">*</span></span><input type="email" name="email" autoComplete="email" maxLength={254} required /></label>
    <label><span>{t("fullNameLabel")} <span className="required-mark">*</span></span><input name="fullName" autoComplete="name" maxLength={160} required /></label>
    <label><span>{t("dateOfBirthLabel")} <span className="required-mark">*</span></span><input type="date" name="dateOfBirth" autoComplete="bday" required /></label>
    <label><span>{t("careOrganisationLabel")}</span><input name="careOrganisation" maxLength={180} /></label>
    <label><span>{t("milestoneYearLabel")} <span className="required-mark">*</span></span><input type="number" name="milestoneYear" min="1900" max="2100" inputMode="numeric" required /></label>
    <label className="consent-label"><input type="checkbox" name="consent" required /><span>{t("adultIdentityConsent")}</span></label>
    <TurnstileWidget siteKey={siteKey} label={common("captchaLabel")} />
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? common("processing") : t("submitIdentityRequest")}</button>
    <FormFeedback status={state.status} successText={t("identityRequestReceived")} />
  </form>;
}
