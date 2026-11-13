"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { uploadChildDocument, uploadParentDocument } from "@/app/document-actions";
import { initialActionState } from "@/lib/action-state";

type Mode = "parent" | "child";

export function PrivateDocumentUploadForm({ mode }: { mode: Mode }) {
  const t = useTranslations(mode === "parent" ? "Parent" : "Child");
  const common = useTranslations("Common");
  const router = useRouter();
  const actionFunction = mode === "parent" ? uploadParentDocument : uploadChildDocument;
  const [state, action, pending] = useActionState(actionFunction, initialActionState);
  const types = mode === "parent"
    ? (t.raw("documents") as string[]).map((label, index) => ({ value: ["identity", "address", "income", "medical", "police_verification"][index], label }))
    : [{ value: "education", label: t("educationRecord") }];

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state.status, router]);

  return (
    <form className="form-card upload-form" action={action}>
      <h3>{t("uploadTitle")}</h3>
      <label>
        <span>{t("uploadType")} <span className="required-mark">*</span></span>
        <select name="documentType" required defaultValue={types[0]?.value}>
          {types.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label>
        <span>{common("documentFile")} <span className="required-mark">*</span></span>
        <input type="file" name="file" accept="application/pdf,image/jpeg,image/png" required />
      </label>
      <label className="consent-label">
        <input type="checkbox" name="consent" required />
        <span>{mode === "parent" ? t("uploadConsent") : t("documentConsent")}</span>
      </label>
      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? common("uploading") : common("submit")}
      </button>
      {state.status === "success" && <p className="form-status" role="status">{common("documentUploaded")}</p>}
      {state.status === "error" && <p className="form-status" role="alert">{common("requestFailed")}</p>}
      {state.status === "setup" && <p className="form-status" role="alert">{common("setupRequired")}</p>}
    </form>
  );
}
