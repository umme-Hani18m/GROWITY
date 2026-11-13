"use server";

import { randomUUID } from "node:crypto";
import { getAuthenticatedProfile } from "@/lib/auth";
import { logAdminFundingDocumentAccess, logSensitiveAccess } from "@/lib/audit";
import type { ActionState } from "@/lib/action-state";
import { createServerAdminClient } from "@/lib/supabase/server";
import { uploadMetadataSchema } from "@/lib/validation";

const BUCKET = "private-documents";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

type DocumentMime = "application/pdf" | "image/jpeg" | "image/png";
type UploadData = { bytes: Uint8Array; mime: DocumentMime; size: number; extension: "pdf" | "jpg" | "png" };

async function validateUpload(formData: FormData, allowedTypes: string[]): Promise<UploadData | null> {
  const file = formData.get("file");
  const documentType = String(formData.get("documentType") ?? "");
  const consent = formData.get("consent");
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_FILE_BYTES) return null;
  const metadata = uploadMetadataSchema.safeParse({
    documentType,
    fileName: file.name || "upload",
    mimeType: file.type,
    size: file.size,
    consent
  });
  if (!metadata.success || !allowedTypes.includes(metadata.data.documentType)) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  let signatureOk = false;
  let extension: UploadData["extension"] = "pdf";
  if (metadata.data.mimeType === "application/pdf") {
    signatureOk = new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
    extension = "pdf";
  } else if (metadata.data.mimeType === "image/jpeg") {
    signatureOk = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    extension = "jpg";
  } else if (metadata.data.mimeType === "image/png") {
    signatureOk = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    extension = "png";
  }
  if (!signatureOk) return null;
  return { bytes, mime: metadata.data.mimeType, size: file.size, extension };
}

async function removeObject(path: string): Promise<void> {
  try {
    await createServerAdminClient().storage.from(BUCKET).remove([path]);
  } catch {
    // A failed cleanup leaves an unlinked private object; no personal data or provider details are logged.
  }
}

async function recordUploadConsent(userId: string, actorId: string, consentVersion: string): Promise<boolean> {
  if (userId === actorId) {
    const user = await getAuthenticatedProfile();
    if (!user) return false;
    const { error } = await user.supabase.from("consents").insert({
      user_id: userId,
      consent_type: "document_upload",
      document_version: consentVersion
    });
    return !error;
  }
  try {
    const { error } = await createServerAdminClient().from("consents").insert({
      user_id: userId,
      actor_user_id: actorId,
      consent_type: "document_upload",
      document_version: consentVersion
    });
    return !error;
  } catch {
    return false;
  }
}

export async function uploadParentDocument(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const current = await getAuthenticatedProfile("parent");
  if (!current) return { status: "error" };
  const upload = await validateUpload(formData, ["identity", "address", "income", "medical", "police_verification"]);
  if (!upload) return { status: "error" };
  try {
    const { data: application, error: appError } = await current.supabase.from("parent_applications")
      .select("id").eq("user_id", current.user.id).maybeSingle();
    if (appError || !application) return { status: "error" };
    if (!(await logSensitiveAccess(current.supabase, "parent_applications", application.id))) return { status: "error" };
    const id = randomUUID();
    const documentType = String(formData.get("documentType"));
    const path = `parent/${current.user.id}/${id}.${upload.extension}`;
    const { error: storageError } = await current.supabase.storage.from(BUCKET).upload(path, upload.bytes, {
      contentType: upload.mime,
      upsert: false,
      cacheControl: "0"
    });
    if (storageError) return { status: "error" };
    const consentVersion = `document-upload-v1-${id}`;
    if (!(await recordUploadConsent(current.user.id, current.user.id, consentVersion))) {
      await removeObject(path);
      return { status: "error" };
    }
    const { error: recordError } = await current.supabase.from("parent_documents").insert({
      id,
      application_id: application.id,
      owner_user_id: current.user.id,
      document_type: documentType,
      storage_path: path,
      mime_type: upload.mime,
      file_size_bytes: upload.size,
      verification_status: "submitted"
    });
    if (recordError) {
      await removeObject(path);
      return { status: "error" };
    }
    return { status: "success" };
  } catch {
    return { status: "setup" };
  }
}

export async function uploadChildDocument(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const current = await getAuthenticatedProfile("child");
  if (!current) return { status: "error" };
  const upload = await validateUpload(formData, ["education"]);
  if (!upload) return { status: "error" };
  try {
    const { data: child, error: childError } = await current.supabase.from("children").select("id")
      .eq("user_id", current.user.id).maybeSingle();
    if (childError || !child || !(await logSensitiveAccess(current.supabase, "children", child.id))) return { status: "error" };
    const id = randomUUID();
    const path = `child/${child.id}/${id}.${upload.extension}`;
    const { error: storageError } = await current.supabase.storage.from(BUCKET).upload(path, upload.bytes, {
      contentType: upload.mime,
      upsert: false,
      cacheControl: "0"
    });
    if (storageError) return { status: "error" };
    const consentVersion = `document-upload-v1-${id}`;
    if (!(await recordUploadConsent(current.user.id, current.user.id, consentVersion))) {
      await removeObject(path);
      return { status: "error" };
    }
    const { error: recordError } = await current.supabase.from("documents").insert({
      id,
      child_id: child.id,
      document_type: "education",
      storage_path: path,
      mime_type: upload.mime,
      file_size_bytes: upload.size,
      uploaded_by: current.user.id
    });
    if (recordError) {
      await removeObject(path);
      return { status: "error" };
    }
    return { status: "success" };
  } catch {
    return { status: "setup" };
  }
}

export async function uploadNgoDocument(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const current = await getAuthenticatedProfile("ngo");
  if (!current || !current.profile.ngo_id) return { status: "error" };
  const upload = await validateUpload(formData, ["recognition", "compliance", "funding_support"]);
  if (!upload) return { status: "error" };
  try {
    const { data: ngo, error: ngoError } = await current.supabase.from("ngos").select("verification_status")
      .eq("id", current.profile.ngo_id).maybeSingle();
    if (ngoError || ngo?.verification_status !== "verified") return { status: "error" };
    const id = randomUUID();
    const path = `ngo/${current.profile.ngo_id}/${id}.${upload.extension}`;
    const { error: storageError } = await current.supabase.storage.from(BUCKET).upload(path, upload.bytes, {
      contentType: upload.mime,
      upsert: false,
      cacheControl: "0"
    });
    if (storageError) return { status: "error" };
    if (!(await recordUploadConsent(current.user.id, current.user.id, `document-upload-v1-${id}`))) {
      await removeObject(path);
      return { status: "error" };
    }
    const { error: recordError } = await current.supabase.from("documents").insert({
      id,
      ngo_id: current.profile.ngo_id,
      document_type: String(formData.get("documentType")),
      storage_path: path,
      mime_type: upload.mime,
      file_size_bytes: upload.size,
      uploaded_by: current.user.id
    });
    if (recordError) {
      await removeObject(path);
      return { status: "error" };
    }
    return { status: "success" };
  } catch {
    return { status: "setup" };
  }
}

export async function downloadPrivateDocument(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("documentId") ?? "");
  const table = String(formData.get("table") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["documents", "parent_documents"].includes(table)) return { status: "error" };
  const current = await getAuthenticatedProfile();
  if (!current) return { status: "error" };
  if (table === "parent_documents" && !["parent", "staff"].includes(current.profile.role)) return { status: "error" };
  if (table === "documents" && !["child", "adult_after_care", "ngo", "staff"].includes(current.profile.role)) return { status: "error" };
  try {
    const { data: document, error } = await current.supabase.from(table)
      .select("id, storage_path").eq("id", id).maybeSingle();
    if (error || !document) return { status: "error" };
    const auditOk = table === "documents" && current.profile.role === "staff" && current.profile.sub_role === "admin"
      ? await logAdminFundingDocumentAccess(current.supabase, id)
      : await logSensitiveAccess(current.supabase, table, id, "document_download");
    if (!auditOk) return { status: "error" };
    const { data: signed, error: signedError } = await current.supabase.storage.from(BUCKET)
      .createSignedUrl(document.storage_path, 60, { download: true });
    if (signedError || !signed?.signedUrl) return { status: "error" };
    return { status: "success", downloadUrl: signed.signedUrl };
  } catch {
    return { status: "setup" };
  }
}
