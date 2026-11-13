"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createChildAccount, resetChildPinLockout } from "@/app/auth-actions";
import { addCompatibilityNote, claimNextFosterInterest, recordAdoptionTrackerStep, scheduleCaseMeeting, updateFosterFollowUp, updateSupportRequestStatus } from "@/app/staff-actions";
import { initialActionState, type ActionState } from "@/lib/action-state";

type Option = { value: string; label: string };
type ChildOption = { id: string; publicCode: string };

function Feedback({ state }: { state: ActionState }) {
  const common = useTranslations("Common");
  if (state.status === "success") return <p className="form-status" role="status">{common("saved")}</p>;
  if (state.status === "error") return <p className="form-status" role="alert">{common("requestFailed")}</p>;
  if (state.status === "setup") return <p className="form-status" role="alert">{common("setupRequired")}</p>;
  return null;
}

function useRefreshAfterSuccess(status: ActionState["status"]) {
  const router = useRouter();
  useEffect(() => { if (status === "success") router.refresh(); }, [status, router]);
}

export function StaffChildAccountForm() {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(createChildAccount, initialActionState);
  useRefreshAfterSuccess(state.status);
  const languages = t.raw("childLanguageOptions") as Option[];
  return <form className="form-card" action={action}>
    <h3>{t("createChildAccount")}</h3>
    <label>{t("childPublicCode")}<input name="publicCode" autoComplete="off" minLength={6} maxLength={24} pattern="[A-Za-z0-9-]{6,24}" required /></label>
    <label>{t("childLegalName")}<input name="legalName" autoComplete="off" maxLength={160} required /></label>
    <label>{t("childDob")}<input name="dateOfBirth" type="date" required /></label>
    <label>{t("childBackground")}<textarea name="background" maxLength={4000} rows={3} /></label>
    <label>{t("childPin")}<input type="password" name="pin" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{6}" minLength={6} maxLength={6} required /></label>
    <label>{t("childLanguage")}<select name="language" required>{languages.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label className="consent-label"><input type="checkbox" name="guardianConsent" required /><span>{t("guardianConsent")}</span></label>
    <button className="button button-primary" disabled={pending}>{pending ? common("processing") : t("createChild")}</button>
    <Feedback state={state} />
  </form>;
}

export function ChildPinLockoutResetForm({ childId, publicCode }: { childId: string; publicCode: string }) {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(resetChildPinLockout, initialActionState);
  useRefreshAfterSuccess(state.status);
  return <form className="inline-action" action={action}>
    <input type="hidden" name="childId" value={childId} />
    <span>{publicCode}</span>
    <button className="button button-small button-secondary" type="submit" disabled={pending}>{pending ? common("processing") : t("resetChildLockout")}</button>
    <Feedback state={state} />
  </form>;
}

export function FosterFollowUpForm({ interestId }: { interestId: string }) {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(updateFosterFollowUp, initialActionState);
  useRefreshAfterSuccess(state.status);
  const statuses = t.raw("fosterStatusOptions") as Option[];
  const forwarded = t.raw("forwardedOptions") as Option[];
  return <form className="form-card compact-form" action={action}>
    <input type="hidden" name="interestId" value={interestId} />
    <label>{common("status")}<select name="status" required>{statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label>{t("forwardedToDcpuLabel")}<select name="forwardedToDcpu" required>{forwarded.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label>{t("cwcDecision")}<textarea name="cwcDecision" maxLength={1000} rows={2} /></label>
    <button className="button button-secondary" disabled={pending}>{pending ? common("processing") : common("save")}</button>
    <Feedback state={state} />
  </form>;
}

export function ClaimFosterInterestForm() {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(claimNextFosterInterest, initialActionState);
  useRefreshAfterSuccess(state.status);
  return <form className="inline-action" action={action}>
    <button className="button button-secondary" disabled={pending}>{pending ? common("processing") : t("claimFoster")}</button>
    {state.status === "empty" && <p className="form-note" role="status">{t("noUnassignedFosterInterests")}</p>}
    <Feedback state={state} />
  </form>;
}

export function TrackerStepForm({ applicationId, children }: { applicationId: string; children: ChildOption[] }) {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(recordAdoptionTrackerStep, initialActionState);
  useRefreshAfterSuccess(state.status);
  const steps = t.raw("trackerStepOptions") as Option[];
  return <details className="form-disclosure">
    <summary>{t("recordTrackerStep")}</summary>
    <form className="form-card compact-form" action={action}>
      <input type="hidden" name="applicationId" value={applicationId} />
      <label>{t("trackerStep")}<select name="step" required>{steps.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>{t("stepDate")}<input name="stepDate" type="date" required /></label>
      <label>{t("caringsRegistrationNumber")}<input name="caringsRegistrationNumber" maxLength={100} /></label>
      <label>{t("referralReference")}<input name="referralReference" maxLength={100} /></label>
      <label>{t("childRecord")}<select name="childId" defaultValue=""><option value="">{common("optional")}</option>{children.map((child) => <option key={child.id} value={child.id}>{child.publicCode}</option>)}</select></label>
      <label>{t("adoptionOrderNumber")}<input name="adoptionOrderNumber" maxLength={100} /></label>
      <label>{t("adoptionOrderDate")}<input name="adoptionOrderDate" type="date" /></label>
      <button className="button button-secondary" disabled={pending}>{pending ? common("processing") : common("save")}</button>
      <Feedback state={state} />
    </form>
  </details>;
}

export function CaseMeetingForm({ applicationId, childId }: { applicationId: string; childId: string }) {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(scheduleCaseMeeting, initialActionState);
  useRefreshAfterSuccess(state.status);
  const types = t.raw("meetingTypeOptions") as Option[];
  return <form className="form-card compact-form" action={action}>
    <input type="hidden" name="applicationId" value={applicationId} /><input type="hidden" name="childId" value={childId} />
    <label>{t("meetingType")}<select name="meetingType" required>{types.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label>{t("meetingStartsAt")}<input type="datetime-local" name="startsAt" required /></label>
    <label>{t("meetingLocation")}<input name="location" maxLength={240} /></label>
    <button className="button button-secondary" disabled={pending}>{pending ? common("processing") : t("scheduleMeeting")}</button>
    <Feedback state={state} />
  </form>;
}

export function CompatibilityNoteForm({ applicationId, childId }: { applicationId: string; childId: string }) {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(addCompatibilityNote, initialActionState);
  useRefreshAfterSuccess(state.status);
  return <form className="form-card compact-form" action={action}>
    <input type="hidden" name="applicationId" value={applicationId} /><input type="hidden" name="childId" value={childId} />
    <label>{t("compatibilityNoteLabel")}<textarea name="note" rows={4} maxLength={4000} required /></label>
    <button className="button button-secondary" disabled={pending}>{pending ? common("processing") : t("saveCompatibilityNote")}</button>
    <Feedback state={state} />
  </form>;
}


export function SupportRequestStatusForm({ requestId }: { requestId: string }) {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(updateSupportRequestStatus, initialActionState);
  useRefreshAfterSuccess(state.status);
  const statuses = t.raw("supportStatusOptions") as Option[];
  return <form className="inline-action" action={action}>
    <input type="hidden" name="requestId" value={requestId} />
    <label>{common("status")}<select name="status" required>{statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <button className="button button-small button-secondary" disabled={pending}>{pending ? common("processing") : common("save")}</button>
    <Feedback state={state} />
  </form>;
}
