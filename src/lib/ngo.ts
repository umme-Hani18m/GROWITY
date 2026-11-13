import "server-only";

import { getAuthenticatedProfile } from "@/lib/auth";

export async function getVerifiedNgo() {
  const session = await getAuthenticatedProfile("ngo");
  if (!session?.profile.ngo_id) return null;
  try {
    const { data: organization, error } = await session.supabase.from("ngos")
      .select("id, display_name, recognition_type, recognition_number, recognition_date, renewal_date, registration_number, state, verification_status")
      .eq("id", session.profile.ngo_id).maybeSingle();
    if (error || !organization || organization.verification_status !== "verified") return null;
    return { ...session, organization };
  } catch {
    return null;
  }
}
