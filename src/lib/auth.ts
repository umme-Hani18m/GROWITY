import "server-only";

import { createUserClient } from "@/lib/supabase/server";

export type UserSupabase = Awaited<ReturnType<typeof createUserClient>>;
export type UserProfile = { id: string; role: string; sub_role: string | null; ngo_id: string | null; language: string };

export async function getAuthenticatedProfile(expectedRole?: string) {
  try {
    const supabase = await createUserClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return null;
    const roleClaim = authData.user.app_metadata.role;
    if (typeof roleClaim !== "string" || (expectedRole && roleClaim !== expectedRole)) return null;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, sub_role, ngo_id, language")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileError || !profile || profile.id !== authData.user.id || profile.role !== roleClaim) return null;

    if (profile.role === "staff") {
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || assurance?.currentLevel !== "aal2") return null;
    }
    return { supabase, user: authData.user, profile: profile as UserProfile };
  } catch {
    return null;
  }
}
