import { z } from "zod";

const safeText = (max: number) => z.string().trim().min(1).max(max).refine((value) => !/[\u0000-\u0008\u000B\u000C-\u001F]/.test(value));
const optionalAge = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : Number(value),
  z.number().int().min(0).max(18).optional()
);

export const fosterInterestSchema = z.object({
  name: safeText(120),
  contact: safeText(254).refine((value) => /^(?:[^\s@]+@[^\s@]+\.[^\s@]+|\+?[0-9 ()-]{7,24})$/.test(value), "Enter a valid email or phone number."),
  state: safeText(120),
  consent: z.literal("on"),
  captchaToken: z.string().min(10).max(4096)
}).strict();

export const childReportSchema = z.object({
  category: z.enum(["abuse", "harassment", "neglect", "food_health", "education", "other"]),
  urgency: z.enum(["normal", "serious", "emergency"]),
  details: safeText(5000),
  consent: z.literal("on")
}).strict();

export const supportRequestSchema = z.object({
  topic: z.enum(["foster_care", "other_support"]),
  details: z.string().trim().max(2000).optional().default(""),
  consent: z.literal("on")
}).strict();

export const supportRequestUpdateSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["reviewing", "resolved", "closed"])
}).strict();

export const parentOtpRequestSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  captchaToken: z.string().max(4096).optional().default(""),
  consent: z.literal("on")
}).strict();

export const emailOtpVerifySchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  token: z.string().trim().regex(/^\d{6,8}$/)
}).strict();

export const staffLoginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(256)
}).strict();

export const emailOnlySchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase())
}).strict();

export const phoneOnlySchema = z.object({
  phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/)
}).strict();

export const phoneOtpVerifySchema = z.object({
  phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/),
  token: z.string().trim().regex(/^\d{6,8}$/)
}).strict();

export const childPinLoginSchema = z.object({
  publicCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,32}$/),
  pin: z.string().regex(/^(?:\d{4}|\d{6})$/)
}).strict();

export const childOnboardingSchema = z.object({
  publicCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{6,24}$/),
  pin: z.string().regex(/^\d{6}$/),
  legalName: safeText(160),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => Number.isFinite(Date.parse(value)), "Enter a valid date."),
  background: z.string().trim().max(4000).optional().default(""),
  guardianConsent: z.literal("on"),
  language: z.enum(["en", "hi"])
}).strict();

export const childOnboardingRequestSchema = z.object({
  preferredName: safeText(80),
  ageRange: z.enum(["under_13", "13_to_17"]),
  state: safeText(120),
  safeContact: z.string().trim().max(254).optional().default(""),
  guardianOrCaseworkerKnown: z.literal("on"),
  consent: z.literal("on")
}).strict();

const adultDateOfBirth = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return false;
  const cutoff = new Date();
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 18);
  return date <= cutoff;
}, "The applicant must be at least 18 years old.");

export const adultIdentityRequestSchema = z.object({
  pathway: z.enum(["in_care_18_plus", "adopted_18_plus"]),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  fullName: safeText(160),
  dateOfBirth: adultDateOfBirth,
  careOrganisation: z.string().trim().max(180).optional().default(""),
  milestoneYear: z.preprocess((value) => Number(value), z.number().int().min(1900).max(2100)),
  captchaToken: z.string().min(1),
  consent: z.literal("on")
}).strict();

export const adultIdentityDecisionSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["verified", "rejected"])
}).strict();

export const childOnboardingCompletionSchema = z.object({
  requestId: z.string().uuid(),
  legalName: safeText(160),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => Number.isFinite(Date.parse(value)), "Enter a valid date."),
  language: z.enum(["en", "hi"]),
  guardianConsent: z.literal("on")
}).strict();
export const childPinLockoutResetSchema = z.object({
  childId: z.string().uuid()
}).strict();

export const uploadMetadataSchema = z.object({
  documentType: z.enum(["identity", "address", "income", "medical", "police_verification", "education", "care_record", "recognition", "compliance", "funding_support"]),
  fileName: safeText(255),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  size: z.number().int().positive().max(10 * 1024 * 1024),
  consent: z.literal("on")
}).strict();

export const ngoChildEntrySchema = z.object({
  publicCode: z.string().trim().min(8).max(32).regex(/^[A-Z0-9-]+$/),
  cwcOrderNumber: safeText(100),
  status: z.enum(["in_care", "foster_care", "closed"])
}).strict();

export const fundingRequestSchema = z.object({
  amountPaise: z.number().int().positive().max(100_000_000),
  purpose: safeText(1000),
  supportDocumentId: z.string().uuid()
}).strict();

export const ngoReportSchema = z.object({
  reportMonth: z.string().regex(/^\d{4}-\d{2}-01$/),
  newEntriesCount: z.number().int().min(0).max(100_000)
}).strict();

export const dataRightsRequestSchema = z.object({
  requestType: z.enum(["download", "delete_non_legal_data", "legal_record_access"]),
  reason: z.string().trim().max(1000).optional().default("")
}).strict();

export const grievanceSchema = z.object({
  category: z.enum(["corruption", "harassment", "inconvenience"]),
  details: safeText(4000),
  anonymous: z.boolean(),
  personNamed: z.string().trim().max(120).optional()
}).strict();

export const parentPreferencesSchema = z.object({
  preferredReligion: z.string().trim().max(80).optional().default(""),
  preferredAgeMin: optionalAge,
  preferredAgeMax: optionalAge
}).strict().refine((value) => value.preferredAgeMin === undefined || value.preferredAgeMax === undefined || value.preferredAgeMin <= value.preferredAgeMax);

export const parentDocumentVerificationSchema = z.object({
  documentId: z.string().uuid(),
  decision: z.enum(["verified", "rejected"])
}).strict();

export const adoptionTrackerSchema = z.object({
  applicationId: z.string().uuid(),
  childId: z.string().uuid().optional(),
  step: z.enum(["documents_submitted", "documents_verified", "in_person_check", "carings_registered", "home_study_done", "child_referred", "child_reserved", "pre_adoption_foster_care", "adoption_order_issued", "post_adoption_follow_up"]),
  stepDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  caringsRegistrationNumber: z.string().trim().max(100).optional().default(""),
  referralReference: z.string().trim().max(100).optional().default(""),
  adoptionOrderNumber: z.string().trim().max(100).optional().default(""),
  adoptionOrderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""))
}).strict();

export const caseMeetingSchema = z.object({
  applicationId: z.string().uuid(),
  childId: z.string().uuid(),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).refine((value) => Date.parse(`${value}:00+05:30`) > Date.now()),
  meetingType: z.enum(["counselling", "meeting"]),
  location: z.string().trim().max(240).optional().default("")
}).strict();

export const compatibilityNoteSchema = z.object({
  applicationId: z.string().uuid(),
  childId: z.string().uuid(),
  note: safeText(4000)
}).strict();

export const complaintOutcomeSchema = z.object({
  complaintId: z.string().uuid(),
  contacted: z.enum(["police_unit", "childline_1098", "cwc", "other"]),
  contactedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).refine((value) => Number.isFinite(Date.parse(`${value}:00+05:30`))),
  method: z.enum(["phone", "in_person", "email", "other"]),
  notes: z.string().trim().max(1000).optional().default("")
}).strict();

export const grievanceStatusSchema = z.object({
  grievanceId: z.string().uuid(),
  status: z.enum(["reviewing", "resolved", "closed"])
}).strict();

export const fosterFollowUpSchema = z.object({
  interestId: z.string().uuid(),
  status: z.enum(["contacted", "forwarded", "closed"]),
  forwardedToDcpu: z.enum(["yes", "no"]),
  cwcDecision: z.string().trim().max(1000).optional().default("")
}).strict();

export const ngoDecisionSchema = z.object({
  ngoId: z.string().uuid(),
  decision: z.enum(["verified", "suspended", "rejected"])
}).strict();

export const fundingDecisionSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approve", "reject"])
}).strict();

export const staffSubRoleSchema = z.object({
  staffId: z.string().uuid(),
  subRole: z.enum(["verification_team", "caseworker", "protection_officer", "grievance_committee", "admin"])
}).strict();
