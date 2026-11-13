import "server-only";

import type { UserSupabase } from "@/lib/auth";

export type SensitiveAuditAction = "view" | "document_download" | "complaint_list";

export async function logSensitiveAccess(
  supabase: UserSupabase,
  entityTable: string,
  entityId: string | null,
  action: SensitiveAuditAction = "view"
): Promise<boolean> {
  const { error } = await supabase.rpc("log_audit_event", {
    p_entity_table: entityTable,
    p_entity_id: entityId,
    p_action: action
  });
  return !error;
}

export async function logCaseRecordAccess(
  supabase: UserSupabase,
  entityTable: "case_meetings" | "compatibility_notes",
  entityId: string
): Promise<boolean> {
  const { error } = await supabase.rpc("log_case_record_view", {
    p_entity_table: entityTable,
    p_entity_id: entityId
  });
  return !error;
}

export async function logAdminFundingDocumentAccess(supabase: UserSupabase, documentId: string): Promise<boolean> {
  const { error } = await supabase.rpc("log_admin_funding_document_access", { p_document_id: documentId });
  return !error;
}
