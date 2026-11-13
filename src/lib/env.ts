import "server-only";
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(10).optional(),
  CHILD_PIN_PEPPER: z.string().min(32).optional(),
  RATE_LIMIT_HMAC_SECRET: z.string().min(32).optional(),
  RESEND_API_KEY: z.string().min(10).optional(),
  APP_URL: z.string().url().optional(),
  SMS_OTP_ENABLED: z.enum(["true", "false"]).default("false"),
  ON_CALL_PROTECTION_EMAIL: z.string().email().optional(),
  FROM_EMAIL: z.string().email().optional()
}).superRefine((value, context) => {
  const supabaseStarted = Boolean(value.NEXT_PUBLIC_SUPABASE_URL || value.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (supabaseStarted && (!value.NEXT_PUBLIC_SUPABASE_URL || !value.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    context.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SUPABASE_URL"], message: "Set both public Supabase variables together." });
  }
  const captchaStarted = Boolean(value.TURNSTILE_SITE_KEY || value.TURNSTILE_SECRET_KEY);
  if (captchaStarted && (!value.TURNSTILE_SITE_KEY || !value.TURNSTILE_SECRET_KEY)) {
    context.addIssue({ code: "custom", path: ["TURNSTILE_SITE_KEY"], message: "Set both Turnstile variables together." });
  }
  if (value.RESEND_API_KEY && (!value.ON_CALL_PROTECTION_EMAIL || !value.FROM_EMAIL)) {
    context.addIssue({ code: "custom", path: ["ON_CALL_PROTECTION_EMAIL"], message: "Email alerts require a key, recipient, and verified sender." });
  }
});

export type AppEnvironment = z.infer<typeof schema>;

export function readEnvironment(): AppEnvironment {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path[0]).filter(Boolean))].join(", ");
    throw new Error(`Invalid environment configuration: ${names}`);
  }
  return result.data;
}

export function tryReadEnvironment(): AppEnvironment | null {
  try {
    return readEnvironment();
  } catch {
    return null;
  }
}

export function validateEnvironmentAtStartup(): void {
  readEnvironment();
}

export function hasSupabaseEnvironment(environment = readEnvironment()): boolean {
  return Boolean(environment.NEXT_PUBLIC_SUPABASE_URL && environment.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
