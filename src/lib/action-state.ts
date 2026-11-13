export type ActionState = {
  status: "idle" | "success" | "sent" | "neutral" | "setup" | "error" | "urgent_followup" | "mfa" | "mfa_enroll" | "verified" | "empty";
  email?: string;
  phone?: string;
  downloadUrl?: string;
  dataExport?: string;
  errorCode?: "wrong_code" | "expired_code" | "too_many_tries" | "delivery_failed";
  mfaFactorId?: string;
  mfaQr?: string;
  mfaSecret?: string;
  requestId?: string;
  publicCode?: string;
  oneTimePin?: string;
};

export const initialActionState: ActionState = { status: "idle" };
