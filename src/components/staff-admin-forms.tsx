"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { decideNgoVerification, recordFundingDecision, updateStaffSubRole } from "@/app/staff-actions";
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

export function NgoVerificationForm({ ngoId, status }: { ngoId: string; status: string }) {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(decideNgoVerification, initialActionState);
  useRefreshAfterSuccess(state.status);
  const options = t.raw("ngoVerificationOptions") as Option[];
  return <form className="inline-action" action={action}>
    <input type="hidden" name="ngoId" value={ngoId} />
    <label>{t("ngoVerificationStatus")}<select name="decision" defaultValue={status} required>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <button className="button button-small button-secondary" disabled={pending}>{pending ? common("processing") : common("save")}</button>
    <Feedback state={state} />
  </form>;
}

export function FundingDecisionForm({ requestId }: { requestId: string }) {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(recordFundingDecision, initialActionState);
  useRefreshAfterSuccess(state.status);
  return <form className="inline-action" action={action}>
    <input type="hidden" name="requestId" value={requestId} />
    <button className="button button-small button-secondary" name="decision" value="approve" disabled={pending}>{t("approveFunding")}</button>
    <button className="button button-small button-quiet" name="decision" value="reject" disabled={pending}>{t("rejectFunding")}</button>
    {pending && <span className="form-note">{common("processing")}</span>}
    <Feedback state={state} />
  </form>;
}

export function StaffSubRoleForm({ staffId, currentRole }: { staffId: string; currentRole: string }) {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(updateStaffSubRole, initialActionState);
  useRefreshAfterSuccess(state.status);
  const options = t.raw("staffSubRoleOptions") as Option[];
  return <form className="inline-action" action={action}>
    <input type="hidden" name="staffId" value={staffId} />
    <label>{t("staffSubRole")}<select name="subRole" defaultValue={currentRole} required>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <button className="button button-small button-secondary" disabled={pending}>{pending ? common("processing") : t("updateRole")}</button>
    <Feedback state={state} />
  </form>;
}
