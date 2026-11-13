"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { completeChildOnboardingRequest } from "@/app/auth-actions";
import { decideAdultIdentityRequest } from "@/app/staff-actions";
import { initialActionState, type ActionState } from "@/lib/action-state";

type ChildRequest = { id: string; preferred_name: string; age_range: string; state: string; safe_contact: string | null; status: string; created_at: string };
type AdultRequest = { id: string; pathway: string; email: string; full_name: string; date_of_birth: string; care_organisation: string | null; milestone_year: number; status: string; created_at: string };

function Feedback({ state }: { state: ActionState }) {
  const common = useTranslations("Common");
  if (state.status === "error") return <p className="form-status" role="alert">{common("requestFailed")}</p>;
  if (state.status === "setup") return <p className="form-status" role="alert">{common("setupRequired")}</p>;
  return null;
}

function ChildRequestCompletionForm({ requestId }: { requestId: string }) {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(completeChildOnboardingRequest, initialActionState);
  if (state.status === "success" && state.publicCode && state.oneTimePin) {
    return <div className="credential-reveal" role="status">
      <p><strong>{t("childAccountCreatedOnce")}</strong></p>
      <p>{t("handoffCode")}: <code>{state.publicCode}</code></p>
      <p>{t("handoffPin")}: <code>{state.oneTimePin}</code></p>
      <p className="form-note">{t("handoffWarning")}</p>
    </div>;
  }
  return <form className="form-card compact-form" action={action}>
    <input type="hidden" name="requestId" value={requestId} />
    <label>{t("childLegalName")}<input name="legalName" maxLength={160} required /></label>
    <label>{t("childDob")}<input name="dateOfBirth" type="date" required /></label>
    <label>{t("childLanguage")}<select name="language" defaultValue="en" required><option value="en">English</option><option value="hi">हिन्दी</option></select></label>
    <label className="consent-label"><input type="checkbox" name="guardianConsent" required /><span>{t("guardianConsent")}</span></label>
    <button className="button button-secondary" type="submit" disabled={pending}>{pending ? common("processing") : t("completeChildAccount")}</button>
    <Feedback state={state} />
  </form>;
}

function AdultIdentityDecisionForm({ requestId }: { requestId: string }) {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const router = useRouter();
  const [state, action, pending] = useActionState(decideAdultIdentityRequest, initialActionState);
  useEffect(() => { if (state.status === "success") router.refresh(); }, [state.status, router]);
  return <form className="inline-action" action={action}>
    <input type="hidden" name="requestId" value={requestId} />
    <label className="sr-only" htmlFor={`adult-decision-${requestId}`}>{t("identityDecision")}</label>
    <select id={`adult-decision-${requestId}`} name="decision" defaultValue="verified" required>
      <option value="verified">{t("markVerified")}</option>
      <option value="rejected">{t("markRejected")}</option>
    </select>
    <button className="button button-small button-secondary" type="submit" disabled={pending}>{pending ? common("processing") : common("save")}</button>
    <Feedback state={state} />
  </form>;
}

export function ChildOnboardingRequests({ requests }: { requests: ChildRequest[] }) {
  const t = useTranslations("Team");
  return <section className="dashboard-section"><h2>{t("childOnboardingQueueTitle")}</h2>
    {!requests.length ? <p className="empty-state">{t("noChildOnboardingRequests")}</p> : requests.map((request) => <article className="record-card" key={request.id}>
      <h3>{request.preferred_name}</h3>
      <p>{t("ageRangeLabel")}: {request.age_range} · {request.state}</p>
      {request.safe_contact && <p>{t("safeContactLabel")}: {request.safe_contact}</p>}
      <p className="form-note">{request.created_at}</p>
      <ChildRequestCompletionForm requestId={request.id} />
    </article>)}
  </section>;
}

export function AdultIdentityRequests({ requests }: { requests: AdultRequest[] }) {
  const t = useTranslations("Team");
  return <section className="dashboard-section"><h2>{t("adultIdentityQueueTitle")}</h2>
    {!requests.length ? <p className="empty-state">{t("noAdultIdentityRequests")}</p> : requests.map((request) => <article className="record-card" key={request.id}>
      <h3>{request.full_name}</h3>
      <p>{request.email} · {request.pathway}</p>
      <p>{request.date_of_birth} · {request.milestone_year}{request.care_organisation ? ` · ${request.care_organisation}` : ""}</p>
      <AdultIdentityDecisionForm requestId={request.id} />
    </article>)}
  </section>;
}
