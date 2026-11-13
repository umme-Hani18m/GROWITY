"use server";

import { createHmac, randomInt, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { tryReadEnvironment } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { createServerAdminClient, createUserClient } from "@/lib/supabase/server";
import { childOnboardingCompletionSchema, childOnboardingSchema, childPinLoginSchema, childPinLockoutResetSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

function deriveChildPassword(childId: string, pin: string, pepper: string): string {
  return `${createHmac("sha256", pepper).update(`${childId}:${pin}:growity-child-v1`).digest("base64url")}aA9!`;
}

async function isCaseworker(supabase: Awaited<ReturnType<typeof createUserClient>>, userId: string): Promise<boolean> {
  const { data: profile, error } = await supabase.from("profiles").select("role, sub_role").eq("id", userId).maybeSingle();
  if (error || profile?.role !== "staff" || profile?.sub_role !== "caseworker") return false;
  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || assurance?.currentLevel !== "aal2") return false;
  const { data: agreement, error: agreementError } = await supabase.from("consents").select("id")
    .eq("user_id", userId).eq("consent_type", "staff_code_conduct")
    .eq("document_version", "staff-code-v1").maybeSingle();
  return !agreementError && Boolean(agreement);
}

export async function signInChild(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = childPinLoginSchema.safeParse({ publicCode: formData.get("publicCode"), pin: formData.get("pin") });
  if (!parsed.success) return { status: "error" };
  const environment = tryReadEnvironment();
  if (!environment || !environment.NEXT_PUBLIC_SUPABASE_URL || !environment.NEXT_PUBLIC_SUPABASE_ANON_KEY || !environment.SUPABASE_SERVICE_ROLE_KEY || !environment.CHILD_PIN_PEPPER || !environment.RATE_LIMIT_HMAC_SECRET) {
    return { status: "setup" };
  }
  try {
    const requestHeaders = await headers();
    const address = requestHeaders.get("x-real-ip") ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateKey = createHmac("sha256", environment.RATE_LIMIT_HMAC_SECRET).update(`${parsed.data.publicCode}:${address}`).digest("hex");
    const admin = createServerAdminClient();
    const { data: child, error: childError } = await admin.from("children").select("id, user_id").eq("public_code", parsed.data.publicCode).maybeSingle();
    if (childError || !child?.user_id) return { status: "error" };
    const { data: locked, error: lockError } = await admin.rpc("is_child_pin_locked", { p_child_id: child.id });
    if (lockError || locked === true) return { status: "error" };
    const { data: allowed, error: limitError } = await admin.rpc("consume_child_login_attempt", { p_request_hash: rateKey });
    if (limitError || allowed !== true) return { status: "error" };
    const { data: authData, error: authError } = await admin.auth.admin.getUserById(child.user_id);
    if (authError || !authData.user.email) return { status: "error" };
    const supabase = await createUserClient();
    const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
      email: authData.user.email,
      password: deriveChildPassword(child.id, parsed.data.pin, environment.CHILD_PIN_PEPPER)
    });
    if (signInError || !sessionData.user) {
      const { error: failureError } = await admin.rpc("record_child_pin_failure", { p_child_id: child.id });
      return failureError ? { status: "setup" } : { status: "error" };
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", sessionData.user.id).maybeSingle();
    if (profile?.role !== "child") {
      await supabase.auth.signOut({ scope: "local" });
      return { status: "error" };
    }
    return { status: "verified" };
  } catch {
    return { status: "setup" };
  }
}

export async function resetChildPinLockout(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = childPinLockoutResetSchema.safeParse({ childId: formData.get("childId") });
  if (!parsed.success) return { status: "error" };
  const environment = tryReadEnvironment();
  if (!environment?.SUPABASE_SERVICE_ROLE_KEY || !environment.RATE_LIMIT_HMAC_SECRET) return { status: "setup" };
  try {
    const userClient = await createUserClient();
    const { data: current, error: currentError } = await userClient.auth.getUser();
    if (currentError || !current.user || !(await isCaseworker(userClient, current.user.id))) return { status: "error" };
    if (!(await rateLimit("staff-child-pin-reset", current.user.id))) return { status: "error" };
    const admin = createServerAdminClient();
    const { data: child, error: childError } = await admin.from("children").select("id").eq("id", parsed.data.childId).eq("assigned_caseworker_id", current.user.id).maybeSingle();
    if (childError || !child) return { status: "error" };
    const { error: resetError } = await admin.rpc("reset_child_pin_lockout", { p_child_id: child.id });
    if (resetError) return { status: "setup" };
    const { error: auditError } = await admin.from("audit_log").insert({ actor_id: current.user.id, entity_table: "children", entity_id: child.id, action: "update" });
    return auditError ? { status: "error" } : { status: "success" };
  } catch {
    return { status: "setup" };
  }
}

export async function createChildAccount(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = childOnboardingSchema.safeParse({
    publicCode: formData.get("publicCode"),
    pin: formData.get("pin"),
    legalName: formData.get("legalName"),
    dateOfBirth: formData.get("dateOfBirth"),
    background: formData.get("background"),
    guardianConsent: formData.get("guardianConsent"),
    language: formData.get("language")
  });
  if (!parsed.success) return { status: "error" };
  const environment = tryReadEnvironment();
  if (!environment || !environment.SUPABASE_SERVICE_ROLE_KEY || !environment.CHILD_PIN_PEPPER) return { status: "setup" };

  let newAuthUserId: string | undefined;
  let caseworkerId: string | undefined;
  const childId = randomUUID();
  try {
    const userClient = await createUserClient();
    const { data: current, error: currentError } = await userClient.auth.getUser();
    if (currentError || !current.user || !(await isCaseworker(userClient, current.user.id))) return { status: "error" };
    caseworkerId = current.user.id;
    const admin = createServerAdminClient();
    const alias = `child-${randomUUID()}@children.growity.invalid`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: alias,
      email_confirm: true,
      password: deriveChildPassword(childId, parsed.data.pin, environment.CHILD_PIN_PEPPER),
      app_metadata: { role: "child" }
    });
    if (createError || !created.user) return { status: "error" };
    newAuthUserId = created.user.id;
    const { error: profileError } = await admin.from("profiles").upsert({
      id: newAuthUserId,
      role: "child",
      sub_role: null,
      full_name: parsed.data.legalName,
      language: parsed.data.language
    }, { onConflict: "id" });
    if (profileError) throw new Error("profile");
    const { error: childError } = await admin.from("children").insert({
      id: childId,
      public_code: parsed.data.publicCode,
      user_id: newAuthUserId,
      status: "in_care",
      assigned_caseworker_id: current.user.id
    });
    if (childError) throw new Error("child");
    const { error: assignmentError } = await admin.from("staff_assignments").insert({
      staff_user_id: current.user.id,
      child_id: childId,
      assignment_type: "caseworker",
      active: true
    });
    if (assignmentError) throw new Error("assignment");
    const { error: privateError } = await admin.from("child_private").insert({
      child_id: childId,
      legal_name: parsed.data.legalName,
      date_of_birth: parsed.data.dateOfBirth,
      background: parsed.data.background
    });
    if (privateError) throw new Error("private");
    const { error: consentError } = await admin.from("consents").insert({
      user_id: newAuthUserId,
      actor_user_id: current.user.id,
      consent_type: "child_onboarding_guardian",
      document_version: "child-onboarding-v1"
    });
    if (consentError) throw new Error("consent");
    await admin.from("audit_log").insert({ actor_id: current.user.id, entity_table: "children", entity_id: childId, action: "child_account_created" });
    return { status: "success" };
  } catch {
    if (newAuthUserId) {
      try {
        const admin = createServerAdminClient();
        await admin.from("child_private").delete().eq("child_id", childId);
        await admin.from("consents").delete().eq("user_id", newAuthUserId).eq("consent_type", "child_onboarding_guardian");
        if (caseworkerId) await admin.from("staff_assignments").delete().eq("staff_user_id", caseworkerId).eq("child_id", childId);
        await admin.from("children").delete().eq("id", childId);
        await admin.from("profiles").delete().eq("id", newAuthUserId);
        await admin.auth.admin.deleteUser(newAuthUserId);
      } catch {
        // Do not write child details or secrets to logs. Resolve partial setup through a secure admin review.
      }
    }
    return { status: "error" };
  }
}

export async function completeChildOnboardingRequest(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = childOnboardingCompletionSchema.safeParse({
    requestId: formData.get("requestId"),
    legalName: formData.get("legalName"),
    dateOfBirth: formData.get("dateOfBirth"),
    language: formData.get("language"),
    guardianConsent: formData.get("guardianConsent")
  });
  if (!parsed.success) return { status: "error" };
  const environment = tryReadEnvironment();
  if (!environment || !environment.SUPABASE_SERVICE_ROLE_KEY || !environment.CHILD_PIN_PEPPER) return { status: "setup" };

  let newAuthUserId: string | undefined;
  const childId = randomUUID();
  try {
    const userClient = await createUserClient();
    const { data: current, error: currentError } = await userClient.auth.getUser();
    if (currentError || !current.user || !(await isCaseworker(userClient, current.user.id))) return { status: "error" };
    const admin = createServerAdminClient();
    const { data: request, error: requestError } = await admin.from("child_onboarding_requests")
      .select("id,preferred_name,age_range,status")
      .eq("id", parsed.data.requestId)
      .in("status", ["pending", "in_review"])
      .maybeSingle();
    if (requestError || !request) return { status: "error" };

    let publicCode = "";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = `C-${randomInt(100000, 1000000)}`;
      const { data: existing, error: existingError } = await admin.from("children").select("id").eq("public_code", candidate).maybeSingle();
      if (existingError) return { status: "setup" };
      if (!existing) {
        publicCode = candidate;
        break;
      }
    }
    if (!publicCode) return { status: "setup" };
    const oneTimePin = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const alias = `child-${randomUUID()}@children.growity.invalid`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: alias,
      email_confirm: true,
      password: deriveChildPassword(childId, oneTimePin, environment.CHILD_PIN_PEPPER),
      app_metadata: { role: "child" }
    });
    if (createError || !created.user) return { status: "error" };
    newAuthUserId = created.user.id;

    const { error: profileError } = await admin.from("profiles").upsert({
      id: newAuthUserId,
      role: "child",
      sub_role: null,
      full_name: parsed.data.legalName,
      language: parsed.data.language
    }, { onConflict: "id" });
    if (profileError) throw new Error("profile");
    const { error: childError } = await admin.from("children").insert({
      id: childId,
      public_code: publicCode,
      user_id: newAuthUserId,
      status: "in_care",
      assigned_caseworker_id: current.user.id
    });
    if (childError) throw new Error("child");
    const { error: assignmentError } = await admin.from("staff_assignments").insert({
      staff_user_id: current.user.id,
      child_id: childId,
      assignment_type: "caseworker",
      active: true
    });
    if (assignmentError) throw new Error("assignment");
    const { error: privateError } = await admin.from("child_private").insert({
      child_id: childId,
      legal_name: parsed.data.legalName,
      date_of_birth: parsed.data.dateOfBirth
    });
    if (privateError) throw new Error("private");
    const { error: consentError } = await admin.from("consents").insert({
      user_id: newAuthUserId,
      actor_user_id: current.user.id,
      consent_type: "child_onboarding_guardian",
      document_version: "child-onboarding-v1"
    });
    if (consentError) throw new Error("consent");
    const { data: updatedRequest, error: requestUpdateError } = await admin.from("child_onboarding_requests").update({
      status: "completed",
      assigned_caseworker_id: current.user.id,
      completed_child_id: childId,
      completed_at: new Date().toISOString()
    }).eq("id", request.id).in("status", ["pending", "in_review"]).select("id").maybeSingle();
    if (requestUpdateError || !updatedRequest) throw new Error("request");
    const { error: auditError } = await admin.from("audit_log").insert({ actor_id: current.user.id, entity_table: "children", entity_id: childId, action: "child_account_created" });
    if (auditError) throw new Error("audit");
    return { status: "success", requestId: request.id, publicCode, oneTimePin };
  } catch {
    if (newAuthUserId) {
      try {
        const admin = createServerAdminClient();
        await admin.from("child_private").delete().eq("child_id", childId);
        await admin.from("consents").delete().eq("user_id", newAuthUserId).eq("consent_type", "child_onboarding_guardian");
        await admin.from("staff_assignments").delete().eq("child_id", childId);
        await admin.from("children").delete().eq("id", childId);
        await admin.from("profiles").delete().eq("id", newAuthUserId);
        await admin.auth.admin.deleteUser(newAuthUserId);
      } catch {
        // Do not write child details or credentials to logs. Resolve partial setup through a secure review.
      }
    }
    return { status: "error" };
  }
}
