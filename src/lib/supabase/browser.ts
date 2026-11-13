"use client";

import { createBrowserClient } from "@supabase/ssr";
import { createProjectKeyFetch, getSupabaseProjectUrl } from "./url";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

function isPlainLocalHttp(): boolean {
  if (typeof window === "undefined") return false;
  const { protocol, hostname } = window.location;
  return protocol === "http:" && (hostname === "localhost" || hostname === "127.0.0.1");
}

export function getBrowserSupabaseClient() {
  if (browserClient) return browserClient;
  const url = getSupabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const localHttp = isPlainLocalHttp();
  browserClient = createBrowserClient(url, anonKey, {
    global: { fetch: createProjectKeyFetch(anonKey) },
    cookieOptions: {
      sameSite: "lax",
      secure: !localHttp,
      maxAge: 30 * 60,
      path: "/"
    }
  });
  return browserClient;
}
