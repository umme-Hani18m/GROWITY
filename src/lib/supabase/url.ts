const SUPABASE_CLOUD_SUFFIXES = new Set(["/rest/v1", "/auth/v1"]);

/**
 * Supabase clients require the project origin. Accept the documented root URL,
 * or repair only the common REST/Auth endpoint suffix on Supabase Cloud hosts.
 * Unexpected paths, URL credentials, queries, fragments, and non-HTTPS remote
 * origins fail closed.
 */
export function getSupabaseProjectUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const localHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && localHost)) return null;

    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    const isRoot = path === "/";
    const isKnownSupabaseEndpoint = parsed.hostname.endsWith(".supabase.co") && SUPABASE_CLOUD_SUFFIXES.has(path);
    if (!isRoot && !isKnownSupabaseEndpoint) return null;

    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * New Supabase publishable/secret keys are not JWTs. Keep the SDK's apikey
 * header, but remove its default Bearer copy of that exact key; retain any
 * different Authorization value because it may be the signed-in user's JWT.
 */
export function createProjectKeyFetch(projectKey: string): typeof fetch {
  if (!projectKey.startsWith("sb_publishable_") && !projectKey.startsWith("sb_secret_")) return fetch;

  return async (input, init) => {
    const requestHeaders = input instanceof Request ? input.headers : undefined;
    const headers = new Headers(requestHeaders);
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
    if (headers.get("authorization")?.trim() === `Bearer ${projectKey}`) {
      headers.delete("authorization");
    }
    return fetch(input, { ...init, headers });
  };
}
