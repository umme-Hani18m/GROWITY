"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { acceptStaffAgreement } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";

export function StaffAgreementForm() {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const router = useRouter();
  const [state, action, pending] = useActionState(acceptStaffAgreement, initialActionState);
  useEffect(() => { if (state.status === "success") router.refresh(); }, [state.status, router]);
  return <form className="form-card" action={action}>
    <h3>{t("agreementTitle")}</h3>
    <p>{t("agreementBody")}</p>
    <label className="consent-label"><input type="checkbox" name="consent" required /><span>{t("agreementConsent")}</span></label>
    <button className="button button-primary" disabled={pending}>{pending ? common("processing") : t("acceptAgreement")}</button>
    {state.status === "error" && <p className="form-status" role="alert">{common("requestFailed")}</p>}
    {state.status === "setup" && <p className="form-status" role="alert">{common("setupRequired")}</p>}
  </form>;
}
