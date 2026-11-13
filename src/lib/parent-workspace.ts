import "server-only";
import { getAuthenticatedProfile } from "@/lib/auth";
import { logSensitiveAccess } from "@/lib/audit";

export async function getParentWorkspace() {
  const parent = await getAuthenticatedProfile("parent");
  if (!parent) return null;
  const { data: application, error: applicationError } = await parent.supabase.from("parent_applications")
    .select("id, status, preferred_religion, preferred_age_min, preferred_age_max, created_at, updated_at")
    .eq("user_id", parent.user.id).maybeSingle();
  if (applicationError || !application) return { parent, application: null, tracker: [], documents: [] };
  if (!(await logSensitiveAccess(parent.supabase, "parent_applications", application.id))) return null;

  const { data: trackerRows, error: trackerError } = await parent.supabase.from("adoption_tracker")
    .select("id, step, step_date, carings_registration_number, referral_reference, adoption_order_number, adoption_order_date, created_at")
    .eq("application_id", application.id).order("step_date", { ascending: true });
  if (trackerError) return null;
  for (const row of trackerRows ?? []) {
    if (!(await logSensitiveAccess(parent.supabase, "adoption_tracker", row.id))) return null;
  }

  const { data: documentRows, error: documentError } = await parent.supabase.from("parent_documents")
    .select("id, document_type, verification_status, created_at, storage_path")
    .eq("application_id", application.id).order("created_at", { ascending: false });
  if (documentError) return null;
  for (const document of documentRows ?? []) {
    if (!(await logSensitiveAccess(parent.supabase, "parent_documents", document.id))) return null;
  }

  return { parent, application, tracker: trackerRows ?? [], documents: documentRows ?? [] };
}
