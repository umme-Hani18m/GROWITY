"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { downloadMyAfterCareData, requestDeletionOfNonLegalData } from "@/app/data-actions";
import { initialActionState } from "@/lib/action-state";

export function AfterCareDataControls() {
  const t = useTranslations("Child");
  const common = useTranslations("Common");
  const [downloadState, downloadAction, downloading] = useActionState(downloadMyAfterCareData, initialActionState);
  const [deletionState, deletionAction, requesting] = useActionState(requestDeletionOfNonLegalData, initialActionState);
  const handledExport = useRef<string | null>(null);

  useEffect(() => {
    const payload = downloadState.dataExport;
    if (!payload || handledExport.current === payload) return;
    handledExport.current = payload;
    const file = new Blob([payload], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "growity-my-data.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }, [downloadState.dataExport]);

  return (
    <div className="data-rights-controls">
      <form action={downloadAction}>
        <button className="button button-primary" type="submit" disabled={downloading}>
          {downloading ? common("processing") : common("downloadData")}
        </button>
        {downloadState.status === "error" && <p className="form-status" role="alert">{common("requestFailed")}</p>}
        {downloadState.status === "setup" && <p className="form-status" role="alert">{common("setupRequired")}</p>}
      </form>
      <form className="form-card" action={deletionAction}>
        <label>
          <span>{common("requestDeletion")}</span>
          <textarea name="reason" rows={3} maxLength={1000} />
        </label>
        <button className="button button-secondary" type="submit" disabled={requesting}>
          {requesting ? common("processing") : common("requestDeletion")}
        </button>
        {deletionState.status === "success" && <p className="form-status" role="status">{common("verificationPending")}</p>}
        {deletionState.status === "error" && <p className="form-status" role="alert">{common("requestFailed")}</p>}
      </form>
      <p className="form-note">{t("adultAfterCareIntro")}</p>
    </div>
  );
}
