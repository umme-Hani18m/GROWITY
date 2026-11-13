"use server";

import { getVerifiedNgo } from "@/lib/ngo";
import type { ActionState } from "@/lib/action-state";
import { fundingRequestSchema, ngoChildEntrySchema, ngoReportSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";

export async function addNgoChildEntry(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = ngoChildEntrySchema.safeParse({
    publicCode: formData.get("publicCode"),
    cwcOrderNumber: formData.get("cwcOrderNumber"),
    status: formData.get("status")
  });
  if (!input.success) return { status: "error" };
  const organization = await getVerifiedNgo();
  if (!organization || !(await rateLimit("ngo-child-entry", organization.user.id))) return { status: "error" };
  try {
    const { error } = await organization.supabase.from("children").insert({
      public_code: input.data.publicCode,
      cwc_order_number: input.data.cwcOrderNumber,
      status: input.data.status,
      ngo_id: organization.organization.id
    });
    return error ? { status: "error" } : { status: "success" };
  } catch {
    return { status: "setup" };
  }
}

export async function submitNgoMonthlyReport(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const count = Number(formData.get("newEntriesCount"));
  const month = String(formData.get("reportMonth") ?? "");
  const reportMonth = /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : month;
  const input = ngoReportSchema.safeParse({ reportMonth, newEntriesCount: count });
  if (!input.success) return { status: "error" };
  const organization = await getVerifiedNgo();
  if (!organization || !(await rateLimit("ngo-monthly-report", organization.user.id))) return { status: "error" };
  try {
    const { error } = await organization.supabase.from("ngo_reports").insert({
      ngo_id: organization.organization.id,
      report_month: input.data.reportMonth,
      new_entries_count: input.data.newEntriesCount,
      submitted_by: organization.user.id
    });
    return error ? { status: "error" } : { status: "success" };
  } catch {
    return { status: "setup" };
  }
}

export async function submitNgoFundingRequest(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const rupees = String(formData.get("amountRupees") ?? "").trim();
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(rupees)) return { status: "error" };
  const input = fundingRequestSchema.safeParse({
    amountPaise: Math.round(Number(rupees) * 100),
    purpose: formData.get("purpose"),
    supportDocumentId: formData.get("supportDocumentId")
  });
  if (!input.success) return { status: "error" };
  const organization = await getVerifiedNgo();
  if (!organization || !(await rateLimit("ngo-funding", organization.user.id))) return { status: "error" };
  try {
    const { data: document, error: documentError } = await organization.supabase.from("documents")
      .select("id, ngo_id, document_type").eq("id", input.data.supportDocumentId).maybeSingle();
    if (documentError || !document || document.ngo_id !== organization.organization.id || document.document_type !== "funding_support") return { status: "error" };
    const { error } = await organization.supabase.from("funding_requests").insert({
      ngo_id: organization.organization.id,
      created_by: organization.user.id,
      amount_paise: input.data.amountPaise,
      purpose: input.data.purpose,
      support_document_id: input.data.supportDocumentId,
      status: "submitted"
    });
    return error ? { status: "error" } : { status: "success" };
  } catch {
    return { status: "setup" };
  }
}
