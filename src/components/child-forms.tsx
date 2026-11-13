"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { submitChildReport, submitChildSupportRequest } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";

const categories = ["abuse", "harassment", "neglect", "food_health", "education", "other"] as const;
const urgencyValues = ["normal", "serious", "emergency"] as const;

export function ChildReportForm() {
  const t = useTranslations("Child");
  const common = useTranslations("Common");
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitChildReport, initialActionState);
  const categoryLabels = t.raw("categories") as string[];
  const urgencyLabels = t.raw("urgencies") as string[];

  useEffect(() => {
    if (state.status === "success" || state.status === "urgent_followup") router.refresh();
  }, [state.status, router]);

  return (
    <form className="form-card child-form" action={formAction}>
      <label>
        <span>{t("categoryLabel")} <span className="required-mark">*</span></span>
        <select name="category" required defaultValue="">
          <option value="" disabled>{common("required")}</option>
          {categories.map((value, index) => <option key={value} value={value}>{categoryLabels[index]}</option>)}
        </select>
      </label>
      <label>
        <span>{t("urgencyLabel")} <span className="required-mark">*</span></span>
        <select name="urgency" defaultValue="normal" required>
          {urgencyValues.map((value, index) => <option key={value} value={value}>{urgencyLabels[index]}</option>)}
        </select>
      </label>
      <p className="urgent-note">{t("urgentHelp")}</p>
      <label>
        <span>{t("detailsLabel")} <span className="required-mark">*</span></span>
        <textarea name="details" minLength={1} maxLength={5000} rows={6} required />
      </label>
      <label className="consent-label">
        <input type="checkbox" name="consent" required />
        <span>{t("confidentialConsent")}</span>
      </label>
      <button className="button button-primary" type="submit" disabled={pending}>{pending ? common("processing") : t("submitReport")}</button>
      {state.status === "success" && <p className="form-status" role="status">{t("reportSubmitted")}</p>}
      {state.status === "urgent_followup" && <p className="form-status form-status-urgent" role="alert">{t("urgentFollowUp")}</p>}
      {state.status === "error" && <p className="form-status" role="alert">{common("requestFailed")}</p>}
      {state.status === "setup" && <p className="form-status" role="alert">{common("setupRequired")}</p>}
    </form>
  );
}

export function ChildSupportForm() {
  const t = useTranslations("Child");
  const common = useTranslations("Common");
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitChildSupportRequest, initialActionState);
  const topics = t.raw("supportTopics") as string[];

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state.status, router]);

  return (
    <form className="form-card child-form" action={formAction}>
      <label>
        <span>{t("supportTitle")} <span className="required-mark">*</span></span>
        <select name="topic" defaultValue="foster_care" required>
          <option value="foster_care">{topics[0]}</option>
          <option value="other_support">{topics[1]}</option>
        </select>
      </label>
      <label>
        <span>{t("detailsLabel")}</span>
        <textarea name="details" maxLength={2000} rows={4} />
      </label>
      <label className="consent-label">
        <input type="checkbox" name="consent" required />
        <span>{common("consent")}</span>
      </label>
      <button className="button button-primary" type="submit" disabled={pending}>{pending ? common("processing") : t("requestSupport")}</button>
      {state.status === "success" && <p className="form-status" role="status">{t("supportSubmitted")}</p>}
      {state.status === "error" && <p className="form-status" role="alert">{common("requestFailed")}</p>}
      {state.status === "setup" && <p className="form-status" role="alert">{common("setupRequired")}</p>}
    </form>
  );
}
