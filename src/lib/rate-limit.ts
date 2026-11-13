import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { readEnvironment } from "@/lib/env";
import { createServerAdminClient } from "@/lib/supabase/server";

export async function rateLimit(scope: string, identity: string, kind: "public" | "child" = "public"): Promise<boolean> {
  try {
    const environment = readEnvironment();
    if (!environment.SUPABASE_SERVICE_ROLE_KEY || !environment.RATE_LIMIT_HMAC_SECRET) return false;
    const requestHeaders = await headers();
    const address = requestHeaders.get("x-real-ip") ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const digest = createHmac("sha256", environment.RATE_LIMIT_HMAC_SECRET)
      .update(`${scope}:${identity}:${address}`)
      .digest("hex");
    const admin = createServerAdminClient();
    const { data, error } = kind === "child"
      ? await admin.rpc("consume_child_login_attempt", { p_request_hash: digest })
      : await admin.rpc("consume_public_submission_attempt", { p_request_hash: digest });
    return !error && data === true;
  } catch {
    return false;
  }
}
