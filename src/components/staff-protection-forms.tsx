"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { claimNextStaffGrievance, updateGrievanceStatus, verifyParentDocument, recordEmergencyOutcome } from "@/app/staff-actions";
import { initialActionState, type ActionState } from "@/lib/action-state";

type Option = { value: string; label: string };

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

export function ParentDocumentDecisionForm({ documentId }: { documentId: string }) {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(verifyParentDocument, initialActionState);
  useRefreshAfterSuccess(state.status);
  return <form className="compact-form inline-action" action={action}>
    <input type="hidden" name="documentId" value={documentId} />
    <button className="button button-small button-secondary" name="decision" value="verified" disabled={pending}>{t("verifyDocument")}</button>
    <button className="button button-small button-quiet" name="decision" value="rejected" disabled={pending}>{t("rejectDocument")}</button>
    {pending && <span className="form-note">{common("processing")}</span>}
    <Feedback state={state} />
  </form>;
}

export function EmergencyOutcomeForm({ complaintId }: { complaintId: string }) {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(recordEmergencyOutcome, initialActionState);
  useRefreshAfterSuccess(state.status);
  const contacts = t.raw("complaintContactOptions") as Option[];
  const methods = t.raw("complaintMethodOptions") as Option[];
  return <form className="form-card compact-form emergency-outcome-form" action={action}>
    <input type="hidden" name="complaintId" value={complaintId} />
    <p className="form-note">{t("emergencyRequired")}</p>
    <label>{t("outcomeContact")}<select name="contacted" required>{contacts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label>{t("outcomeWhen")}<input type="datetime-local" name="contactedAt" required /></label>
    <label>{t("outcomeMethod")}<select name="method" required>{methods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label>{t("outcomeNotes")}<textarea name="notes" maxLength={1000} rows={3} /></label>
    <button className="button button-primary" disabled={pending}>{pending ? common("processing") : t("recordOutcome")}</button>
    <Feedback state={state} />
  </form>;
}

export function GrievanceStatusForm({ grievanceId }: { grievanceId: string }) {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(updateGrievanceStatus, initialActionState);
  useRefreshAfterSuccess(state.status);
  return <form className="inline-action" action={action}>
    <input type="hidden" name="grievanceId" value={grievanceId} />
    <button className="button button-small button-secondary" name="status" value="reviewing" disabled={pending}>{t("markReviewing")}</button>
    <button className="button button-small button-primary" name="status" value="resolved" disabled={pending}>{t("markResolved")}</button>
    {pending && <span className="form-note">{common("processing")}</span>}
    <Feedback state={state} />
  </form>;
}

export function ClaimStaffGrievanceForm() {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(claimNextStaffGrievance, initialActionState);
  useRefreshAfterSuccess(state.status);
  return <form className="inline-action" action={action}>
    <button className="button button-secondary" disabled={pending}>{pending ? common("processing") : t("claimGrievance")}</button>
    {state.status === "empty" && <p className="form-note" role="status">{t("noUnassignedGrievances")}</p>}
    <Feedback state={state} />
  </form>;
}
