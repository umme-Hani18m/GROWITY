"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { downloadPrivateDocument } from "@/app/document-actions";
import { initialActionState } from "@/lib/action-state";

type Props = { documentId: string; table: "documents" | "parent_documents" };

export function PrivateDocumentDownloadButton({ documentId, table }: Props) {
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(downloadPrivateDocument, initialActionState);

  useEffect(() => {
    if (state.status === "success" && state.downloadUrl) window.location.assign(state.downloadUrl);
  }, [state.status, state.downloadUrl]);

  return (
    <form action={action}>
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="table" value={table} />
      <button className="button button-small button-secondary" type="submit" disabled={pending}>
        {pending ? common("processing") : common("downloadDocument")}
      </button>
      {state.status === "error" && <p className="form-status" role="alert">{common("requestFailed")}</p>}
    </form>
  );
}
