"use server";

import { createHmac, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { tryReadEnvironment } from "@/lib/env";
import { createServerAdminClient, createUserClient } from "@/lib/supabase/server";
import { rateLimit as sharedRateLimit } from "@/lib/rate-limit";
import {
  childReportSchema,
  childOnboardingRequestSchema,
  adultIdentityRequestSchema,
  emailOnlySchema,
  emailOtpVerifySchema,
  fosterInterestSchema,
  grievanceSchema,
  parentOtpRequestSchema,
  staffLoginSchema,
  supportRequestSchema
} from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

async function verifyCaptcha(token: string, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}

async function requestAddress(): Promise<string> {
  const requestHeaders = await headers();
  return requestHeaders.get("x-real-ip") ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function rateLimit(scope: string, identity: string, kind: "public" | "child" = "public"): Promise<boolean> {
  try {
    return await sharedRateLimit(scope, identity, kind);
  } catch {
    return false;
  }
}

function safeEnvironment() {
  return tryReadEnvironment();
}

function otpErrorCode(message: string | undefined): ActionState["errorCode"] {
  const value = (message ?? "").toLowerCase();
  if (value.includes("expired")) return "expired_code";
  if (value.includes("too many") || value.includes("rate limit") || value.includes("security violation")) return "too_many_tries";
  if (value.includes("otp_disabled") || value.includes("signups not allowed") || value.includes("email provider") || value.includes("smtp")) return "delivery_failed";
  if (value.includes("invalid") || value.includes("otp") || value.includes("token")) return "wrong_code";
  return "delivery_failed";
}

function otpEnvironmentReady(environment: ReturnType<typeof tryReadEnvironment>, captcha = false): boolean {
  return Boolean(
    environment?.NEXT_PUBLIC_SUPABASE_URL &&
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    environment.SUPABASE_SERVICE_ROLE_KEY &&
    environment.RATE_LIMIT_HMAC_SECRET &&
    (!captcha || (environment.TURNSTILE_SITE_KEY && environment.TURNSTILE_SECRET_KEY))
  );
}

async function authenticatedRole(expectedRole: string) {
  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.app_metadata.role !== expectedRole) return null;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, sub_role, ngo_id")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError || profile?.role !== expectedRole) return null;
  return { supabase, user: data.user, profile };
}

async function verifiedStaff() {
  const staff = await authenticatedRole("staff");
  if (!staff) return null;
  const { data: assurance, error } = await staff.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || assurance?.currentLevel !== "aal2") return null;
  return staff;
}

export async function submitFosterInterest(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const environment = safeEnvironment();
  if (!environment || !environment.SUPABASE_SERVICE_ROLE_KEY || !environment.TURNSTILE_SITE_KEY || !environment.TURNSTILE_SECRET_KEY || !environment.RATE_LIMIT_HMAC_SECRET) {
    return { status: "setup" };
  }
  const input = fosterInterestSchema.safeParse({
    name: formData.get("name"),
    contact: formData.get("contact"),
    state: formData.get("state"),
    consent: formData.get("consent"),
    captchaToken: formData.get("captchaToken")
  });
  if (!input.success || !(await verifyCaptcha(input.data?.captchaToken ?? "", environment.TURNSTILE_SECRET_KEY))) {
    return { status: "error" };
  }
  try {
    const requestHash = createHmac("sha256", environment.RATE_LIMIT_HMAC_SECRET)
      .update(await requestAddress())
      .digest("hex");
    const admin = createServerAdminClient();
    const { error } = await admin.rpc("submit_foster_interest", {
      p_name: input.data.name,
      p_contact: input.data.contact,
      p_state: input.data.state,
      p_consent_version: "foster-interest-v1",
      p_request_hash: requestHash
    });
    return error ? { status: "error" } : { status: "success" };
  } catch {
    return { status: "setup" };
  }
}

export async function requestChildAccount(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = childOnboardingRequestSchema.safeParse({
    preferredName: formData.get("preferredName"),
    ageRange: formData.get("ageRange"),
    state: formData.get("state"),
    safeContact: formData.get("safeContact") || undefined,
    guardianOrCaseworkerKnown: formData.get("guardianOrCaseworkerKnown"),
    consent: formData.get("consent")
  });
  const environment = safeEnvironment();
  if (!input.success) return { status: "error" };
  if (!environment?.SUPABASE_SERVICE_ROLE_KEY || !environment.RATE_LIMIT_HMAC_SECRET) return { status: "setup" };
  if (!(await rateLimit("child-account-request", `${input.data.preferredName}:${input.data.state}`))) {
    return { status: "error", errorCode: "too_many_tries" };
  }
  try {
    const admin = createServerAdminClient();
    const { error } = await admin.from("child_onboarding_requests").insert({
      preferred_name: input.data.preferredName,
      age_range: input.data.ageRange,
      state: input.data.state,
      safe_contact: input.data.safeContact || null,
      guardian_or_caseworker_known: true,
      consented_at: new Date().toISOString(),
      status: "pending"
    });
    return error ? { status: "setup" } : { status: "success" };
  } catch {
    return { status: "setup" };
  }
}

export async function requestAdultIdentity(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = adultIdentityRequestSchema.safeParse({
    pathway: formData.get("pathway"),
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    dateOfBirth: formData.get("dateOfBirth"),
    careOrganisation: formData.get("careOrganisation") || undefined,
    milestoneYear: formData.get("milestoneYear"),
    captchaToken: formData.get("captchaToken"),
    consent: formData.get("consent")
  });
  const environment = safeEnvironment();
  if (!input.success) return { status: "error" };
  if (!environment?.SUPABASE_SERVICE_ROLE_KEY || !environment.RATE_LIMIT_HMAC_SECRET || !environment.TURNSTILE_SECRET_KEY || !environment.TURNSTILE_SITE_KEY) return { status: "setup" };
  if (!(await verifyCaptcha(input.data.captchaToken, environment.TURNSTILE_SECRET_KEY))) return { status: "error" };
  if (!(await rateLimit("adult-identity-request", input.data.email))) {
    return { status: "error", errorCode: "too_many_tries" };
  }
  try {
    const admin = createServerAdminClient();
    const { error } = await admin.from("adult_identity_requests").insert({
      pathway: input.data.pathway,
      email: input.data.email,
      full_name: input.data.fullName,
      date_of_birth: input.data.dateOfBirth,
      care_organisation: input.data.careOrganisation || null,
      milestone_year: input.data.milestoneYear,
      consented_at: new Date().toISOString(),
      status: "pending"
    });
    return error ? { status: "setup" } : { status: "neutral" };
  } catch {
    return { status: "setup" };
  }
}

export async function requestParentEmailOtp(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const environment = safeEnvironment();
  if (!environment || !otpEnvironmentReady(environment, true)) {
    return { status: "setup" };
  }
  const input = parentOtpRequestSchema.safeParse({
    email: formData.get("email"),
    captchaToken: formData.get("captchaToken"),
    consent: formData.get("consent")
  });
  if (!input.success) return { status: "error" };
  if (!(await verifyCaptcha(input.data.captchaToken, environment.TURNSTILE_SECRET_KEY ?? ""))) {
    return { status: "error" };
  }
  if (!(await rateLimit("parent-otp", input.data.email))) return { status: "error", errorCode: "too_many_tries" };
  try {
    const supabase = await createUserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: input.data.email,
      options: { shouldCreateUser: true, captchaToken: input.data.captchaToken }
    });
    return error ? { status: "error", errorCode: otpErrorCode(error.message) } : { status: "sent", email: input.data.email };
  } catch {
    return { status: "setup" };
  }
}

export async function verifyParentEmailOtp(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const environment = safeEnvironment();
  if (!environment || !otpEnvironmentReady(environment)) return { status: "setup" };
  const input = emailOtpVerifySchema.safeParse({ email: formData.get("email"), token: formData.get("token") });
  if (!input.success || formData.get("consent") !== "on") return { status: "error" };
  if (!(await rateLimit("parent-otp-verify", input.data.email))) return { status: "error", errorCode: "too_many_tries" };
  try {
    const supabase = await createUserClient();
    const { data, error } = await supabase.auth.verifyOtp({ email: input.data.email, token: input.data.token, type: "email" });
    if (error || !data.user || (data.user.app_metadata.role !== undefined && data.user.app_metadata.role !== "parent")) {
      await supabase.auth.signOut({ scope: "local" });
      return { status: "error", errorCode: otpErrorCode(error?.message) };
    }
    if (data.user.app_metadata.role !== "parent") {
      const { data: initialProfile, error: initialProfileError } = await supabase.from("profiles")
        .select("role, sub_role").eq("id", data.user.id).maybeSingle();
      if (initialProfileError || initialProfile?.role !== "parent" || initialProfile.sub_role !== null) {
        await supabase.auth.signOut({ scope: "local" });
        return { status: "error" };
      }
      const admin = createServerAdminClient();
      const { error: metadataError } = await admin.auth.admin.updateUserById(data.user.id, {
        app_metadata: { ...data.user.app_metadata, role: "parent" }
      });
      if (metadataError) return { status: "setup" };
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || refreshed.user?.app_metadata.role !== "parent") return { status: "error" };
    }
    const parent = await authenticatedRole("parent");
    if (!parent || parent.user.id !== data.user.id) {
      await supabase.auth.signOut({ scope: "local" });
      return { status: "error" };
    }
    const { data: parentConsent, error: parentConsentLookupError } = await parent.supabase
      .from("consents").select("id").eq("user_id", parent.user.id)
      .eq("consent_type", "parent_signup").eq("document_version", "parent-signup-v1").maybeSingle();
    if (parentConsentLookupError) return { status: "error" };
    if (!parentConsent) {
      const { error: consentError } = await parent.supabase.from("consents").insert({
        user_id: parent.user.id,
        consent_type: "parent_signup",
        document_version: "parent-signup-v1"
      });
      if (consentError) return { status: "error" };
    }
    const { data: existing, error: lookupError } = await parent.supabase
      .from("parent_applications")
      .select("id")
      .eq("user_id", parent.user.id)
      .maybeSingle();
    if (lookupError) return { status: "error" };
    if (!existing) {
      const { error: createError } = await parent.supabase.from("parent_applications").insert({ user_id: parent.user.id, status: "draft" });
      if (createError) return { status: "error" };
    }
    return { status: "verified" };
  } catch {
    return { status: "setup" };
  }
}

export async function signInStaff(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = staffLoginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const environment = safeEnvironment();
  if (!input.success) return { status: "error" };
  if (!environment || !environment.NEXT_PUBLIC_SUPABASE_URL || !environment.NEXT_PUBLIC_SUPABASE_ANON_KEY) return { status: "setup" };
  if (!(await rateLimit("staff-login", input.data.email))) return { status: "error" };
  try {
    const supabase = await createUserClient();
    const { data, error } = await supabase.auth.signInWithPassword(input.data);
    if (error || !data.user || data.user.app_metadata.role !== "staff") {
      await supabase.auth.signOut({ scope: "local" });
      return { status: "error" };
    }
    const staff = await authenticatedRole("staff");
    if (!staff) {
      await supabase.auth.signOut({ scope: "local" });
      return { status: "error" };
    }
    const { data: assurance, error: assuranceError } = await staff.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance?.nextLevel !== "aal2") {
      await staff.supabase.auth.signOut({ scope: "local" });
      return { status: "error" };
    }
    const { data: factors, error: factorsError } = await staff.supabase.auth.mfa.listFactors();
    if (factorsError) return { status: "setup" };
    const verifiedFactor = factors.totp[0];
    if (!verifiedFactor) {
      for (const factor of factors.all.filter((item) => item.factor_type === "totp" && item.status === "unverified")) {
        await staff.supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      const { data: enrollment, error: enrollmentError } = await staff.supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Growity staff authenticator" });
      if (enrollmentError || !enrollment) return { status: "setup" };
      return { status: "mfa_enroll", mfaFactorId: enrollment.id, mfaQr: enrollment.totp.qr_code, mfaSecret: enrollment.totp.secret };
    }
    return assurance.currentLevel === "aal2" ? { status: "verified" } : { status: "mfa" };
  } catch {
    return { status: "setup" };
  }
}

export async function verifyStaffMfa(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6,8}$/.test(code)) return { status: "error" };
  const current = await authenticatedRole("staff");
  if (!current || !(await rateLimit("staff-mfa", current.user.id))) return { status: "error" };
  try {
    const { data: factors, error: factorError } = await current.supabase.auth.mfa.listFactors();
    if (factorError) return { status: "error" };
    const factor = factors.totp.find((item) => item.status === "verified");
    if (!factor) return { status: "error" };
    const { data: challenge, error: challengeError } = await current.supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challengeError) return { status: "error" };
    const { error: verifyError } = await current.supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code });
    if (verifyError) return { status: "error" };
    const { data: assurance, error: assuranceError } = await current.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return !assuranceError && assurance?.currentLevel === "aal2" ? { status: "verified" } : { status: "error" };
  } catch {
    return { status: "setup" };
  }
}

export async function verifyStaffMfaEnrollment(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const factorId = String(formData.get("factorId") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!/^[0-9a-f-]{20,}$/i.test(factorId) || !/^\d{6}$/.test(code)) return { status: "error" };
  const current = await authenticatedRole("staff");
  if (!current || !(await rateLimit("staff-mfa-enroll", current.user.id))) return { status: "error" };
  try {
    const { data: challenge, error: challengeError } = await current.supabase.auth.mfa.challenge({ factorId });
    if (challengeError) return { status: "error" };
    const { error: verifyError } = await current.supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (verifyError) return { status: "error" };
    const { data: assurance, error: assuranceError } = await current.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return !assuranceError && assurance?.currentLevel === "aal2" ? { status: "verified" } : { status: "error" };
  } catch {
    return { status: "setup" };
  }
}

export async function submitChildReport(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = childReportSchema.safeParse({
    category: formData.get("category"),
    urgency: formData.get("urgency"),
    details: formData.get("details"),
    consent: formData.get("consent")
  });
  if (!input.success) return { status: "error" };
  const childUser = await authenticatedRole("child");
  if (!childUser || !(await rateLimit("child-report", childUser.user.id))) return { status: "setup" };
  try {
    const { data: child, error: childError } = await childUser.supabase.from("children").select("id").eq("user_id", childUser.user.id).maybeSingle();
    if (childError || !child) return { status: "setup" };
    const { error: consentError } = await childUser.supabase.from("consents").insert({
      user_id: childUser.user.id,
      consent_type: "child_complaint",
      document_version: `child-complaint-v1-${randomUUID()}`
    });
    if (consentError) return { status: "error" };
    const { error: insertError } = await childUser.supabase.from("complaints").insert({
      child_id: child.id,
      reporter_user_id: childUser.user.id,
      category: input.data.category,
      urgency: input.data.urgency,
      details: input.data.details,
      status: "open"
    });
    if (insertError) return { status: "error" };

    let alerted = false;
    if (input.data.urgency === "emergency") {
      const environment = safeEnvironment();
      if (environment?.RESEND_API_KEY && environment.ON_CALL_PROTECTION_EMAIL && environment.FROM_EMAIL) {
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${environment.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: environment.FROM_EMAIL,
              to: [environment.ON_CALL_PROTECTION_EMAIL],
              subject: "Growity emergency child-safety alert",
              text: "An emergency child-safety report is awaiting response in Growity. Please review the assigned protection queue promptly. Do not reply to this message."
            }),
            cache: "no-store",
            signal: AbortSignal.timeout(7000)
          });
          alerted = response.ok;
        } catch {
          alerted = false;
        }
      }
    }
    return input.data.urgency === "emergency" && !alerted ? { status: "urgent_followup" } : { status: "success" };
  } catch {
    return { status: "setup" };
  }
}

export async function submitChildSupportRequest(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = supportRequestSchema.safeParse({ topic: formData.get("topic"), details: formData.get("details"), consent: formData.get("consent") });
  if (!input.success) return { status: "error" };
  const childUser = await authenticatedRole("child");
  if (!childUser || !(await rateLimit("child-support", childUser.user.id))) return { status: "setup" };
  try {
    const { data: child, error: childError } = await childUser.supabase.from("children").select("id").eq("user_id", childUser.user.id).maybeSingle();
    if (childError || !child) return { status: "setup" };
    const { error } = await childUser.supabase.from("support_requests").insert({
      child_id: child.id,
      requester_user_id: childUser.user.id,
      topic: input.data.topic,
      details: input.data.details,
      status: "open"
    });
    return error ? { status: "error" } : { status: "success" };
  } catch {
    return { status: "setup" };
  }
}

export async function requestNgoEmailOtp(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = emailOnlySchema.safeParse({ email: formData.get("email") });
  const environment = safeEnvironment();
  if (!input.success) return { status: "error" };
  if (!environment || !otpEnvironmentReady(environment, true)) return { status: "setup" };
  if (formData.get("consent") !== "on" || !(await verifyCaptcha(String(formData.get("captchaToken") ?? ""), environment.TURNSTILE_SECRET_KEY ?? ""))) return { status: "error" };
  if (!(await rateLimit("ngo-otp", input.data.email))) return { status: "error", errorCode: "too_many_tries" };
  try {
    const supabase = await createUserClient();
    const { error } = await supabase.auth.signInWithOtp({ email: input.data.email, options: { shouldCreateUser: false, captchaToken: String(formData.get("captchaToken") ?? "") } });
    return error ? { status: "error", errorCode: otpErrorCode(error.message) } : { status: "sent", email: input.data.email };
  } catch {
    return { status: "setup" };
  }
}

export async function verifyNgoEmailOtp(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const environment = safeEnvironment();
  if (!environment || !otpEnvironmentReady(environment)) return { status: "setup" };
  const input = emailOtpVerifySchema.safeParse({ email: formData.get("email"), token: formData.get("token") });
  if (!input.success || formData.get("consent") !== "on" || !(await rateLimit("ngo-otp-verify", input.data.email))) return { status: "error", errorCode: "too_many_tries" };
  try {
    const supabase = await createUserClient();
    const { data, error } = await supabase.auth.verifyOtp({ email: input.data.email, token: input.data.token, type: "email" });
    if (error || !data.user || data.user.app_metadata.role !== "ngo") {
      await supabase.auth.signOut({ scope: "local" });
      return { status: "error", errorCode: otpErrorCode(error?.message) };
    }
    const organization = await authenticatedRole("ngo");
    if (!organization || !organization.profile.ngo_id) {
      await supabase.auth.signOut({ scope: "local" });
      return { status: "error" };
    }
    const { data: ngo, error: ngoError } = await organization.supabase
      .from("ngos")
      .select("verification_status")
      .eq("id", organization.profile.ngo_id)
      .maybeSingle();
    if (ngoError || ngo?.verification_status !== "verified") {
      await supabase.auth.signOut({ scope: "local" });
      return { status: "error" };
    }
    const { data: ngoConsent, error: ngoConsentLookupError } = await organization.supabase
      .from("consents").select("id").eq("user_id", organization.user.id)
      .eq("consent_type", "ngo_onboarding").eq("document_version", "ngo-onboarding-v1").maybeSingle();
    if (ngoConsentLookupError) return { status: "error" };
    if (!ngoConsent) {
      const { error: consentError } = await organization.supabase.from("consents").insert({
        user_id: organization.user.id,
        consent_type: "ngo_onboarding",
        document_version: "ngo-onboarding-v1"
      });
      if (consentError) return { status: "error" };
    }
    return { status: "verified" };
  } catch {
    return { status: "setup" };
  }
}

export async function requestAdultAfterCareOtp(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const environment = safeEnvironment();
  if (!environment || !otpEnvironmentReady(environment, true)) return { status: "setup" };
  const input = emailOnlySchema.safeParse({ email: formData.get("email") });
  if (!input.success || formData.get("consent") !== "on") return { status: "error" };
  if (!(await verifyCaptcha(String(formData.get("captchaToken") ?? ""), environment.TURNSTILE_SECRET_KEY ?? ""))) return { status: "error" };
  if (!(await rateLimit("adult-after-care-otp", input.data.email))) return { status: "error", errorCode: "too_many_tries" };
  try {
    const admin = createServerAdminClient();
    const { data: request, error: requestError } = await admin.from("adult_identity_requests")
      .select("id,full_name,status,auth_user_id")
      .eq("email", input.data.email)
      .eq("status", "verified")
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (requestError) return { status: "setup" };
    if (!request) return { status: "neutral" };

    let authUserId = request.auth_user_id as string | null;
    if (!authUserId) {
      const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (usersError) return { status: "setup" };
      const existing = users.users.find((user) => user.email?.toLowerCase() === input.data.email);
      if (existing && existing.app_metadata.role !== "adult_after_care") return { status: "neutral" };
      if (existing) {
        authUserId = existing.id;
      } else {
        const created = await admin.auth.admin.createUser({
          email: input.data.email,
          email_confirm: true,
          app_metadata: { role: "adult_after_care" }
        });
        if (created.error || !created.data.user) return { status: "setup" };
        authUserId = created.data.user.id;
      }
      const { error: profileError } = await admin.from("profiles").upsert({
        id: authUserId,
        role: "adult_after_care",
        sub_role: null,
        full_name: request.full_name,
        language: "en"
      }, { onConflict: "id" });
      if (profileError) return { status: "setup" };
      await admin.from("adult_identity_requests").update({ auth_user_id: authUserId }).eq("id", request.id);
    }

    const supabase = await createUserClient();
    const { error } = await supabase.auth.signInWithOtp({ email: input.data.email, options: { shouldCreateUser: false } });
    return error ? { status: "error", errorCode: otpErrorCode(error.message) } : { status: "sent", email: input.data.email };
  } catch {
    return { status: "setup" };
  }
}

export async function verifyAdultAfterCareOtp(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const environment = safeEnvironment();
  if (!environment || !otpEnvironmentReady(environment)) return { status: "setup" };
  if (formData.get("consent") !== "on") return { status: "error" };
  const input = emailOtpVerifySchema.safeParse({ email: formData.get("email"), token: formData.get("token") });
  if (!input.success) return { status: "error" };
  if (!(await rateLimit("adult-after-care-verify", input.data.email))) return { status: "error", errorCode: "too_many_tries" };
  try {
    const supabase = await createUserClient();
    const { data, error } = await supabase.auth.verifyOtp({ email: input.data.email, token: input.data.token, type: "email" });
    if (error || !data.user || data.user.app_metadata.role !== "adult_after_care") {
      await supabase.auth.signOut({ scope: "local" });
      return { status: "error", errorCode: otpErrorCode(error?.message) };
    }
    const adult = await authenticatedRole("adult_after_care");
    if (!adult) {
      await supabase.auth.signOut({ scope: "local" });
      return { status: "error" };
    }
    const { data: consent, error: consentLookupError } = await adult.supabase
      .from("consents").select("id").eq("user_id", adult.user.id)
      .eq("consent_type", "adult_after_care_first_login").eq("document_version", "adult-after-care-first-login-v1").maybeSingle();
    if (consentLookupError) return { status: "error" };
    if (!consent) {
      const { error: consentError } = await adult.supabase.from("consents").insert({
        user_id: adult.user.id,
        consent_type: "adult_after_care_first_login",
        document_version: "adult-after-care-first-login-v1"
      });
      if (consentError) return { status: "error" };
    }
    return { status: "verified" };
  } catch {
    return { status: "setup" };
  }
}

export async function acceptStaffAgreement(_previous: ActionState, formData: FormData): Promise<ActionState> {
  if (formData.get("consent") !== "on") return { status: "error" };
  const staff = await verifiedStaff();
  if (!staff) return { status: "error" };
  try {
    const { data: existing, error: lookupError } = await staff.supabase.from("consents")
      .select("id").eq("user_id", staff.user.id).eq("consent_type", "staff_code_conduct")
      .eq("document_version", "staff-code-v1").maybeSingle();
    if (lookupError) return { status: "error" };
    if (existing) return { status: "success" };
    const { error } = await staff.supabase.from("consents").insert({ user_id: staff.user.id, consent_type: "staff_code_conduct", document_version: "staff-code-v1" });
    return error ? { status: "error" } : { status: "success" };
  } catch {
    return { status: "setup" };
  }
}

export async function submitStaffGrievance(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const anonymous = formData.get("anonymous") === "on";
  const input = grievanceSchema.safeParse({
    category: formData.get("category"),
    details: formData.get("details"),
    anonymous,
    personNamed: formData.get("personNamed") || undefined
  });
  if (!input.success) return { status: "error" };
  const staff = await verifiedStaff();
  if (!staff) return { status: "error" };
  try {
    const { data: agreement, error: agreementError } = await staff.supabase.from("consents").select("id")
      .eq("user_id", staff.user.id).eq("consent_type", "staff_code_conduct")
      .eq("document_version", "staff-code-v1").maybeSingle();
    if (agreementError || !agreement) return { status: "error" };
    if (!(await rateLimit("staff-grievance", input.data.anonymous ? "anonymous" : staff.user.id))) return { status: "error" };
    const { error } = await staff.supabase.from("staff_grievances").insert({
      created_by: input.data.anonymous ? null : staff.user.id,
      is_anonymous: input.data.anonymous,
      category: input.data.category,
      person_named: input.data.personNamed ?? null,
      details: input.data.details,
      status: "open"
    });
    return error ? { status: "error" } : { status: "success" };
  } catch {
    return { status: "setup" };
  }
}
