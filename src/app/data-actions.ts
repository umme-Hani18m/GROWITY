"use server";

import { getAuthenticatedProfile } from "@/lib/auth";
import { logSensitiveAccess } from "@/lib/audit";
import type { ActionState } from "@/lib/action-state";
import { dataRightsRequestSchema } from "@/lib/validation";

export async function downloadMyAfterCareData(_previous: ActionState, _formData: FormData): Promise<ActionState> {
  const current = await getAuthenticatedProfile("adult_after_care");
  if (!current) return { status: "error" };
  try {
    const userId = current.user.id;
    const { data: profile, error: profileError } = await current.supabase.from("profiles")
      .select("role, full_name, language, created_at").eq("id", userId).maybeSingle();
    if (profileError || !profile) return { status: "error" };

    const { data: children, error: childError } = await current.supabase.from("children")
      .select("id, public_code, status, cwc_order_number, created_at, updated_at").eq("user_id", userId);
    if (childError || !children?.length) return { status: "error" };

    const childData = [];
    const documents: Array<Record<string, unknown>> = [];
    const complaints: Array<Record<string, unknown>> = [];
    const supportRequests: Array<Record<string, unknown>> = [];

    for (const child of children) {
      if (!(await logSensitiveAccess(current.supabase, "children", child.id))) return { status: "error" };
      const { data: privateRecord, error: privateError } = await current.supabase.from("child_private")
        .select("legal_name, date_of_birth, background, created_at, updated_at").eq("child_id", child.id).maybeSingle();
      if (privateError || !(await logSensitiveAccess(current.supabase, "child_private", child.id))) return { status: "error" };
      childData.push({ ...child, privateRecord });

      const { data: childDocuments, error: documentsError } = await current.supabase.from("documents")
        .select("id, document_type, storage_path, mime_type, file_size_bytes, created_at").eq("child_id", child.id).order("created_at");
      if (documentsError) return { status: "error" };
      for (const document of childDocuments ?? []) {
        if (!(await logSensitiveAccess(current.supabase, "documents", document.id, "document_download"))) return { status: "error" };
        const { data: signed, error: signedError } = await current.supabase.storage.from("private-documents")
          .createSignedUrl(document.storage_path, 60, { download: true });
        if (signedError || !signed?.signedUrl) return { status: "error" };
        documents.push({ id: document.id, type: document.document_type, mimeType: document.mime_type, sizeBytes: document.file_size_bytes, createdAt: document.created_at, downloadUrl: signed.signedUrl, expiresInSeconds: 60 });
      }

      if (!(await logSensitiveAccess(current.supabase, "complaint_list", null, "complaint_list"))) return { status: "error" };
      const { data: childComplaints, error: complaintsError } = await current.supabase.from("complaints")
        .select("id, category, urgency, details, status, created_at, updated_at, due_at").eq("reporter_user_id", userId).eq("child_id", child.id).order("created_at");
      if (complaintsError) return { status: "error" };
      for (const complaint of childComplaints ?? []) {
        if (!(await logSensitiveAccess(current.supabase, "complaints", complaint.id))) return { status: "error" };
        complaints.push(complaint);
      }

      const { data: childRequests, error: requestsError } = await current.supabase.from("support_requests")
        .select("id, topic, details, status, created_at, updated_at").eq("requester_user_id", userId).eq("child_id", child.id).order("created_at");
      if (requestsError) return { status: "error" };
      for (const request of childRequests ?? []) {
        if (!(await logSensitiveAccess(current.supabase, "support_requests", request.id))) return { status: "error" };
        supportRequests.push(request);
      }
    }

    const { data: consents, error: consentError } = await current.supabase.from("consents")
      .select("consent_type, document_version, consented_at").eq("user_id", userId).order("consented_at");
    if (consentError) return { status: "error" };
    const { data: requests, error: rightsError } = await current.supabase.from("data_rights_requests")
      .select("request_type, status, reason, created_at, reviewed_at").eq("user_id", userId).order("created_at");
    if (rightsError) return { status: "error" };

    const payload = {
      schemaVersion: "growity-personal-data-v1",
      exportedAt: new Date().toISOString(),
      account: { email: current.user.email ?? null, ...profile },
      careRecords: childData,
      documents,
      complaints,
      supportRequests,
      consents,
      dataRightsRequests: requests,
      note: "Document download links expire 60 seconds after generation. This export does not permit deletion of minimal legal records."
    };
    return { status: "success", dataExport: JSON.stringify(payload, null, 2) };
  } catch {
    return { status: "setup" };
  }
}

export async function requestDeletionOfNonLegalData(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const current = await getAuthenticatedProfile("adult_after_care");
  if (!current) return { status: "error" };
  const parsed = dataRightsRequestSchema.safeParse({
    requestType: "delete_non_legal_data",
    reason: formData.get("reason") ?? ""
  });
  if (!parsed.success) return { status: "error" };
  try {
    const { error } = await current.supabase.from("data_rights_requests").insert({
      user_id: current.user.id,
      request_type: "delete_non_legal_data",
      reason: parsed.data.reason || null,
      status: "submitted"
    });
    return error ? { status: "error" } : { status: "success" };
  } catch {
    return { status: "setup" };
  }
}
