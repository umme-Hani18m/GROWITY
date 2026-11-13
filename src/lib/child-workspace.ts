import "server-only";
import { getAuthenticatedProfile } from "@/lib/auth";
import { logSensitiveAccess } from "@/lib/audit";

export async function getChildWorkspace() {
  const childUser = await getAuthenticatedProfile("child");
  if (!childUser) return null;
  const { data: child, error: childError } = await childUser.supabase.from("children")
    .select("id, public_code, status, created_at, updated_at").eq("user_id", childUser.user.id).maybeSingle();
  if (childError || !child || !(await logSensitiveAccess(childUser.supabase, "children", child.id))) return null;

  const { data: documents, error: documentError } = await childUser.supabase.from("documents")
    .select("id, document_type, mime_type, file_size_bytes, created_at").eq("child_id", child.id).order("created_at", { ascending: false });
  if (documentError) return null;
  for (const document of documents ?? []) {
    if (!(await logSensitiveAccess(childUser.supabase, "documents", document.id))) return null;
  }

  if (!(await logSensitiveAccess(childUser.supabase, "complaint_list", null, "complaint_list"))) return null;
  const { data: complaints, error: complaintError } = await childUser.supabase.from("complaints")
    .select("id, category, urgency, status, created_at, updated_at, due_at").eq("reporter_user_id", childUser.user.id).order("created_at", { ascending: false });
  if (complaintError) return null;
  for (const complaint of complaints ?? []) {
    if (!(await logSensitiveAccess(childUser.supabase, "complaints", complaint.id))) return null;
  }

  const { data: supportRequests, error: supportError } = await childUser.supabase.from("support_requests")
    .select("id, topic, details, status, created_at, updated_at").eq("requester_user_id", childUser.user.id).order("created_at", { ascending: false });
  if (supportError) return null;
  for (const request of supportRequests ?? []) {
    if (!(await logSensitiveAccess(childUser.supabase, "support_requests", request.id))) return null;
  }

  return { child, documents: documents ?? [], complaints: complaints ?? [], supportRequests: supportRequests ?? [] };
}
