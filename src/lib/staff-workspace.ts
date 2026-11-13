import "server-only";

import { getAuthenticatedProfile } from "@/lib/auth";

export async function getStaffWorkspace() {
  const staff = await getAuthenticatedProfile("staff");
  if (!staff) return null;
  try {
    const { data: agreement, error } = await staff.supabase.from("consents").select("id")
      .eq("user_id", staff.user.id)
      .eq("consent_type", "staff_code_conduct")
      .eq("document_version", "staff-code-v1")
      .maybeSingle();
    if (error) return { staff, hasAgreement: false, available: false };
    return { staff, hasAgreement: Boolean(agreement), available: true };
  } catch {
    return { staff, hasAgreement: false, available: false };
  }
}
