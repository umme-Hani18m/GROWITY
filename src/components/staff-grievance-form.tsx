"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { submitStaffGrievance } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";

const categories = ["corruption", "harassment", "inconvenience"] as const;

export function StaffGrievanceForm() {
  const t = useTranslations("Team");
  const common = useTranslations("Common");
  const [state, formAction, pending] = useActionState(submitStaffGrievance, initialActionState);
  const labels = t.raw("grievanceCategories") as string[];

  return (
    <form className="form-card auth-form" action={formAction}>
      <label>
        <span>{t("grievanceTitle")} <span className="required-mark">*</span></span>
        <select name="category" required defaultValue="corruption">
          {categories.map((category, index) => <option key={category} value={category}>{labels[index]}</option>)}
        </select>
      </label>
      <label>
        <span>{t("personNamed")}</span>
        <input name="personNamed" maxLength={120} autoComplete="off" />
      </label>
      <label>
        <span>{t("grievanceDetails")} <span className="required-mark">*</span></span>
        <textarea name="details" rows={5} maxLength={4000} required />
      </label>
      <label className="consent-label">
        <input type="checkbox" name="anonymous" />
        <span>{t("anonymousLabel")}</span>
      </label>
      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? common("processing") : t("submitGrievance")}
      </button>
      {state.status === "success" && <p className="form-status" role="status">{t("grievanceSuccess")}</p>}
      {state.status === "error" && <p className="form-status" role="alert">{common("requestFailed")}</p>}
      {state.status === "setup" && <p className="form-status" role="alert">{common("setupRequired")}</p>}
    </form>
  );
}
