"use server";

import { getStaffWorkspace } from "@/lib/staff-workspace";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionState } from "@/lib/action-state";
import {
  adoptionTrackerSchema,
  adultIdentityDecisionSchema,
  caseMeetingSchema,
  compatibilityNoteSchema,
  complaintOutcomeSchema,
  fundingDecisionSchema,
  fosterFollowUpSchema,
  grievanceStatusSchema,
  ngoDecisionSchema,
  parentDocumentVerificationSchema,
  staffSubRoleSchema,
  supportRequestUpdateSchema
} from "@/lib/validation";

async function readyStaff(roles: string[]) {
  const workspace = await getStaffWorkspace();
  if (!workspace?.available || !workspace.hasAgreement || !roles.includes(workspace.staff.profile.sub_role ?? "")) return null;
  return workspace.staff;
}

export async function verifyParentDocument(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = parentDocumentVerificationSchema.safeParse({ documentId: formData.get("documentId"), decision: formData.get("decision") });
  if (!input.success) return { status: "error" };
  const staff = await readyStaff(["verification_team"]);
  if (!staff || !(await rateLimit("staff-parent-document", staff.user.id))) return { status: "error" };
  try {
    const { data, error } = await staff.supabase.from("parent_documents").update({
      verification_status: input.data.decision,
      verified_by: input.data.decision === "verified" ? staff.user.id : null,
      verified_at: input.data.decision === "verified" ? new Date().toISOString() : null
    }).eq("id", input.data.documentId).select("id").maybeSingle();
    return error || !data ? { status: "error" } : { status: "success" };
  } catch { return { status: "setup" }; }
}

export async function recordAdoptionTrackerStep(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = adoptionTrackerSchema.safeParse({
    applicationId: formData.get("applicationId"), childId: formData.get("childId") || undefined,
    step: formData.get("step"), stepDate: formData.get("stepDate"),
    caringsRegistrationNumber: formData.get("caringsRegistrationNumber"), referralReference: formData.get("referralReference"),
    adoptionOrderNumber: formData.get("adoptionOrderNumber"), adoptionOrderDate: formData.get("adoptionOrderDate")
  });
  if (!input.success) return { status: "error" };
  const staff = await readyStaff(["verification_team", "caseworker"]);
  if (!staff || !(await rateLimit("staff-tracker-step", staff.user.id))) return { status: "error" };
  if (input.data.step === "child_referred" && (!input.data.childId || !input.data.referralReference)) return { status: "error" };
  if (input.data.step === "adoption_order_issued" && (!input.data.adoptionOrderNumber || !input.data.adoptionOrderDate)) return { status: "error" };
  if (input.data.step === "carings_registered" && !input.data.caringsRegistrationNumber) return { status: "error" };
  try {
    const { error } = await staff.supabase.rpc("record_adoption_tracker_step", {
      p_application_id: input.data.applicationId,
      p_step: input.data.step,
      p_step_date: input.data.stepDate,
      p_carings_registration_number: input.data.caringsRegistrationNumber || null,
      p_referral_reference: input.data.referralReference || null,
      p_adoption_order_number: input.data.adoptionOrderNumber || null,
      p_adoption_order_date: input.data.adoptionOrderDate || null,
      p_child_id: input.data.childId || null
    });
    return error ? { status: "error" } : { status: "success" };
  } catch { return { status: "setup" }; }
}

export async function scheduleCaseMeeting(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = caseMeetingSchema.safeParse({
    applicationId: formData.get("applicationId"), childId: formData.get("childId"), startsAt: formData.get("startsAt"),
    meetingType: formData.get("meetingType"), location: formData.get("location")
  });
  if (!input.success) return { status: "error" };
  const staff = await readyStaff(["caseworker"]);
  if (!staff || !(await rateLimit("staff-case-meeting", staff.user.id))) return { status: "error" };
  try {
    const { error } = await staff.supabase.from("case_meetings").insert({
      application_id: input.data.applicationId,
      child_id: input.data.childId,
      starts_at: new Date(`${input.data.startsAt}:00+05:30`).toISOString(),
      meeting_type: input.data.meetingType,
      location: input.data.location,
      created_by: staff.user.id
    });
    return error ? { status: "error" } : { status: "success" };
  } catch { return { status: "setup" }; }
}

export async function addCompatibilityNote(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = compatibilityNoteSchema.safeParse({ applicationId: formData.get("applicationId"), childId: formData.get("childId"), note: formData.get("note") });
  if (!input.success) return { status: "error" };
  const staff = await readyStaff(["caseworker"]);
  if (!staff || !(await rateLimit("staff-compatibility-note", staff.user.id))) return { status: "error" };
  try {
    const { error } = await staff.supabase.from("compatibility_notes").insert({
      application_id: input.data.applicationId,
      child_id: input.data.childId,
      note: input.data.note,
      created_by: staff.user.id
    });
    return error ? { status: "error" } : { status: "success" };
  } catch { return { status: "setup" }; }
}

export async function recordEmergencyOutcome(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = complaintOutcomeSchema.safeParse({
    complaintId: formData.get("complaintId"), contacted: formData.get("contacted"), contactedAt: formData.get("contactedAt"),
    method: formData.get("method"), notes: formData.get("notes")
  });
  if (!input.success) return { status: "error" };
  const staff = await readyStaff(["protection_officer"]);
  if (!staff || !(await rateLimit("staff-emergency-outcome", staff.user.id))) return { status: "error" };
  try {
    const { data, error } = await staff.supabase.from("complaints").update({
      outcome_contacted: input.data.contacted,
      outcome_contacted_at: new Date(`${input.data.contactedAt}:00+05:30`).toISOString(),
      outcome_method: input.data.method,
      outcome_notes: input.data.notes,
      outcome_recorded_by: staff.user.id,
      status: "action_taken"
    }).eq("id", input.data.complaintId).eq("urgency", "emergency").select("id").maybeSingle();
    return error || !data ? { status: "error" } : { status: "success" };
  } catch { return { status: "setup" }; }
}

export async function updateGrievanceStatus(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = grievanceStatusSchema.safeParse({ grievanceId: formData.get("grievanceId"), status: formData.get("status") });
  if (!input.success) return { status: "error" };
  const staff = await readyStaff(["grievance_committee"]);
  if (!staff || !(await rateLimit("staff-grievance-status", staff.user.id))) return { status: "error" };
  try {
    const { data, error } = await staff.supabase.from("staff_grievances").update({ status: input.data.status })
      .eq("id", input.data.grievanceId).select("id").maybeSingle();
    return error || !data ? { status: "error" } : { status: "success" };
  } catch { return { status: "setup" }; }
}

export async function claimNextStaffGrievance(_previous: ActionState, _formData: FormData): Promise<ActionState> {
  const staff = await readyStaff(["grievance_committee"]);
  if (!staff || !(await rateLimit("staff-grievance-claim", staff.user.id))) return { status: "error" };
  try {
    const { data, error } = await staff.supabase.rpc("claim_next_staff_grievance");
    if (error) return { status: "error" };
    return data ? { status: "success" } : { status: "empty" };
  } catch { return { status: "setup" }; }
}

export async function updateFosterFollowUp(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = fosterFollowUpSchema.safeParse({
    interestId: formData.get("interestId"), status: formData.get("status"),
    forwardedToDcpu: formData.get("forwardedToDcpu"), cwcDecision: formData.get("cwcDecision")
  });
  if (!input.success) return { status: "error" };
  const staff = await readyStaff(["caseworker"]);
  if (!staff || !(await rateLimit("staff-foster-follow-up", staff.user.id))) return { status: "error" };
  try {
    const { data, error } = await staff.supabase.from("foster_interests").update({
      status: input.data.status,
      forwarded_to_dcpu: input.data.forwardedToDcpu === "yes",
      cwc_decision: input.data.cwcDecision || null
    }).eq("id", input.data.interestId).select("id").maybeSingle();
    return error || !data ? { status: "error" } : { status: "success" };
  } catch { return { status: "setup" }; }
}

export async function claimNextFosterInterest(_previous: ActionState, _formData: FormData): Promise<ActionState> {
  const staff = await readyStaff(["caseworker"]);
  if (!staff || !(await rateLimit("staff-foster-claim", staff.user.id))) return { status: "error" };
  try {
    const { data, error } = await staff.supabase.rpc("claim_next_foster_interest");
    if (error) return { status: "error" };
    return data ? { status: "success" } : { status: "empty" };
  } catch { return { status: "setup" }; }
}

export async function decideNgoVerification(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = ngoDecisionSchema.safeParse({ ngoId: formData.get("ngoId"), decision: formData.get("decision") });
  if (!input.success) return { status: "error" };
  const staff = await readyStaff(["admin"]);
  if (!staff || !(await rateLimit("staff-ngo-verification", staff.user.id))) return { status: "error" };
  const verified = input.data.decision === "verified";
  try {
    const { data, error } = await staff.supabase.from("ngos").update({
      verification_status: input.data.decision,
      verified_by: verified ? staff.user.id : null,
      verified_at: verified ? new Date().toISOString() : null
    }).eq("id", input.data.ngoId).select("id").maybeSingle();
    return error || !data ? { status: "error" } : { status: "success" };
  } catch { return { status: "setup" }; }
}

export async function recordFundingDecision(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = fundingDecisionSchema.safeParse({ requestId: formData.get("requestId"), decision: formData.get("decision") });
  if (!input.success) return { status: "error" };
  const staff = await readyStaff(["admin"]);
  if (!staff || !(await rateLimit("staff-funding-decision", staff.user.id))) return { status: "error" };
  try {
    const { data, error } = await staff.supabase.rpc("record_funding_approval", { p_request_id: input.data.requestId, p_decision: input.data.decision });
    return error || typeof data !== "string" ? { status: "error" } : { status: "success" };
  } catch { return { status: "setup" }; }
}

export async function updateStaffSubRole(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = staffSubRoleSchema.safeParse({ staffId: formData.get("staffId"), subRole: formData.get("subRole") });
  if (!input.success) return { status: "error" };
  const staff = await readyStaff(["admin"]);
  if (!staff || staff.user.id === input.data.staffId || !(await rateLimit("staff-role-change", staff.user.id))) return { status: "error" };
  try {
    const { data, error } = await staff.supabase.from("profiles").update({ sub_role: input.data.subRole })
      .eq("id", input.data.staffId).eq("role", "staff").select("id").maybeSingle();
    return error || !data ? { status: "error" } : { status: "success" };
  } catch { return { status: "setup" }; }
}

export async function updateSupportRequestStatus(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = supportRequestUpdateSchema.safeParse({ requestId: formData.get("requestId"), status: formData.get("status") });
  if (!input.success) return { status: "error" };
  const staff = await readyStaff(["caseworker", "verification_team"]);
  if (!staff || !(await rateLimit("staff-support-status", staff.user.id))) return { status: "error" };
  try {
    const { data, error } = await staff.supabase.from("support_requests").update({ status: input.data.status })
      .eq("id", input.data.requestId).select("id").maybeSingle();
    return error || !data ? { status: "error" } : { status: "success" };
  } catch { return { status: "setup" }; }
}

export async function decideAdultIdentityRequest(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = adultIdentityDecisionSchema.safeParse({ requestId: formData.get("requestId"), decision: formData.get("decision") });
  if (!input.success) return { status: "error" };
  const staff = await readyStaff(["caseworker", "verification_team", "admin"]);
  if (!staff || !(await rateLimit("staff-adult-identity", staff.user.id))) return { status: "error" };
  try {
    const verified = input.data.decision === "verified";
    const { data, error } = await staff.supabase.from("adult_identity_requests").update({
      status: input.data.decision,
      verified_by: verified ? staff.user.id : null,
      verified_at: verified ? new Date().toISOString() : null
    }).eq("id", input.data.requestId).in("status", ["pending", "in_review"]).select("id").maybeSingle();
    return error || !data ? { status: "error" } : { status: "success" };
  } catch { return { status: "setup" }; }
}
