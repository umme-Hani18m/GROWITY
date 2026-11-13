"use server";

import { getAuthenticatedProfile } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";
import { parentPreferencesSchema } from "@/lib/validation";

export async function saveParentPreferences(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parent = await getAuthenticatedProfile("parent");
  if (!parent) return { status: "error" };
  const religion = formData.get("preferredReligion");
  const minAge = formData.get("preferredAgeMin");
  const maxAge = formData.get("preferredAgeMax");
  const parsed = parentPreferencesSchema.safeParse({
    preferredReligion: typeof religion === "string" ? religion : "",
    preferredAgeMin: typeof minAge === "string" ? minAge : "",
    preferredAgeMax: typeof maxAge === "string" ? maxAge : ""
  });
  if (!parsed.success) return { status: "error" };
  try {
    const { data, error } = await parent.supabase.from("parent_applications").update({
      preferred_religion: parsed.data.preferredReligion || null,
      preferred_age_min: parsed.data.preferredAgeMin ?? null,
      preferred_age_max: parsed.data.preferredAgeMax ?? null
    }).eq("user_id", parent.user.id).select("id").maybeSingle();
    return error || !data ? { status: "error" } : { status: "success" };
  } catch {
    return { status: "setup" };
  }
}
