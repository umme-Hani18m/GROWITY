"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { addNgoChildEntry, submitNgoFundingRequest, submitNgoMonthlyReport } from "@/app/ngo-actions";
import { uploadNgoDocument } from "@/app/document-actions";
import { initialActionState } from "@/lib/action-state";

type SupportingDocument = { id: string; created_at: string; document_type: string };
const currentMonth = new Date().toISOString().slice(0, 7);

function useRefreshOnSuccess(status: string) {
  const router = useRouter();
  useEffect(() => { if (status === "success") router.refresh(); }, [status, router]);
}

export function NgoChildEntryForm() {
  const t = useTranslations("NGO");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(addNgoChildEntry, initialActionState);
  useRefreshOnSuccess(state.status);
  return <form className="form-card" action={action}>
    <h3>{t("addChildTitle")}</h3>
    <label><span>{t("childPublicCode")} *</span><input name="publicCode" minLength={8} maxLength={32} pattern="[A-Za-z0-9-]+" autoComplete="off" required /></label>
    <label><span>{t("cwcOrderNumber")} *</span><input name="cwcOrderNumber" maxLength={100} required /></label>
    <label><span>{t("childStatus")} *</span><select name="status" defaultValue="in_care"><option value="in_care">{t("statusInCare")}</option><option value="foster_care">{t("statusFosterCare")}</option></select></label>
    <button className="button button-primary" disabled={pending}>{pending ? common("processing") : t("addChild")}</button>
    {state.status === "success" && <p className="form-status" role="status">{t("childCreated")}</p>}
    {state.status === "error" && <p className="form-status" role="alert">{t("ngoActionError")}</p>}
    {state.status === "setup" && <p className="form-status" role="alert">{common("setupRequired")}</p>}
  </form>;
}

export function NgoMonthlyReportForm() {
  const t = useTranslations("NGO");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(submitNgoMonthlyReport, initialActionState);
  useRefreshOnSuccess(state.status);
  return <form className="form-card" action={action}>
    <h3>{t("countsTitle")}</h3>
    <label><span>{t("reportPeriod")} *</span><input type="month" name="reportMonth" defaultValue={currentMonth} required /></label>
    <label><span>{t("newEntryCount")} *</span><input type="number" name="newEntriesCount" min={0} max={100000} inputMode="numeric" required /></label>
    <button className="button button-secondary" disabled={pending}>{pending ? common("processing") : t("submitCounts")}</button>
    {state.status === "success" && <p className="form-status" role="status">{t("ngoActionSuccess")}</p>}
    {state.status === "error" && <p className="form-status" role="alert">{t("ngoActionError")}</p>}
    {state.status === "setup" && <p className="form-status" role="alert">{common("setupRequired")}</p>}
  </form>;
}

export function NgoDocumentUploadForm() {
  const t = useTranslations("NGO");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(uploadNgoDocument, initialActionState);
  useRefreshOnSuccess(state.status);
  return <form className="form-card" action={action}>
    <h3>{t("complianceTitle")}</h3>
    <label><span>{t("uploadType")} *</span><select name="documentType" defaultValue="compliance" required>
      <option value="recognition">{t("recognitionDocument")}</option>
      <option value="compliance">{t("complianceDocument")}</option>
      <option value="funding_support">{t("fundingSupportDocument")}</option>
    </select></label>
    <label><span>{common("documentFile")} *</span><input type="file" name="file" accept="application/pdf,image/jpeg,image/png" required /></label>
    <label className="consent-label"><input type="checkbox" name="consent" required /><span>{t("documentConsent")}</span></label>
    <button className="button button-primary" disabled={pending}>{pending ? common("uploading") : common("submit")}</button>
    {state.status === "success" && <p className="form-status" role="status">{common("documentUploaded")}</p>}
    {state.status === "error" && <p className="form-status" role="alert">{t("ngoActionError")}</p>}
    {state.status === "setup" && <p className="form-status" role="alert">{common("setupRequired")}</p>}
  </form>;
}

export function NgoFundingForm({ documents, locale }: { documents: SupportingDocument[]; locale: string }) {
  const t = useTranslations("NGO");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(submitNgoFundingRequest, initialActionState);
  useRefreshOnSuccess(state.status);
  return <form className="form-card" action={action}>
    <h3>{t("fundingTitle")}</h3>
    <label><span>{t("amount")} *</span><input name="amountRupees" type="number" min="0.01" max="1000000" step="0.01" inputMode="decimal" required /></label>
    <label><span>{t("purpose")} *</span><textarea name="purpose" maxLength={1000} rows={4} required /></label>
    <label><span>{t("supportFile")} *</span><select name="supportDocumentId" required defaultValue="">
      <option value="" disabled>{common("required")}</option>
      {documents.map((document) => <option key={document.id} value={document.id}>{`${document.document_type} · ${new Date(document.created_at).toLocaleDateString(locale)}`}</option>)}
    </select></label>
    {documents.length === 0 && <p className="form-note">{t("uploadFundingFirst")}</p>}
    <button className="button button-secondary" disabled={pending || documents.length === 0}>{pending ? common("processing") : t("submitFunding")}</button>
    {state.status === "success" && <p className="form-status" role="status">{t("ngoActionSuccess")}</p>}
    {state.status === "error" && <p className="form-status" role="alert">{t("ngoActionError")}</p>}
    {state.status === "setup" && <p className="form-status" role="alert">{common("setupRequired")}</p>}
  </form>;
}
