import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { readEnvironment } from "@/lib/env";
import { createProjectKeyFetch, getSupabaseProjectUrl } from "@/lib/supabase/url";

function cookiePolicy(appUrl?: string) {
  let isPlainLocalHttp = false;
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      isPlainLocalHttp = parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
    } catch {
      isPlainLocalHttp = false;
    }
  }
  return {
    sameSite: "lax" as const,
    secure: !isPlainLocalHttp,
    maxAge: 30 * 60,
    path: "/" as const
  };
}

export async function createUserClient() {
  const environment = readEnvironment();
  const projectUrl = getSupabaseProjectUrl(environment.NEXT_PUBLIC_SUPABASE_URL);
  if (!projectUrl || !environment.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase is not configured.");
  }
  const cookieStore = await cookies();
  const policy = cookiePolicy(environment.APP_URL);
  return createServerClient(projectUrl, environment.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { fetch: createProjectKeyFetch(environment.NEXT_PUBLIC_SUPABASE_ANON_KEY) },
    cookieOptions: policy,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, { ...options, ...policy }));
        } catch {
          // Server Components cannot mutate response cookies; Route Handlers and Server Actions can.
        }
      }
    }
  });
}

export function createServerAdminClient() {
  const environment = readEnvironment();
  const projectUrl = getSupabaseProjectUrl(environment.NEXT_PUBLIC_SUPABASE_URL);
  if (!projectUrl || !environment.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Privileged server operation is not configured.");
  }
  return createClient(projectUrl, environment.SUPABASE_SERVICE_ROLE_KEY, {
    global: { fetch: createProjectKeyFetch(environment.SUPABASE_SERVICE_ROLE_KEY) },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}
