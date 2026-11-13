import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = process.env;
if (env.DEMO_MODE !== "true") {
  console.error("Refusing to create demo users: set DEMO_MODE=true explicitly.");
  process.exit(1);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Refusing to create demo users: Supabase URL and service-role key are required.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const password = `GrowityDemo-${randomBytes(12).toString("base64url")}!`;
const users = [
  { local: "child.test", role: "child", subRole: null, fullName: "DEMO CHILD 1001" },
  { local: "ngo.test", role: "ngo", subRole: null, fullName: "DEMO NGO ONE" },
  { local: "admin.test", role: "staff", subRole: "admin", fullName: "DEMO ADMIN" },
  { local: "caseworker.test", role: "staff", subRole: "caseworker", fullName: "DEMO CASEWORKER" },
  { local: "verifier.test", role: "staff", subRole: "verification_team", fullName: "DEMO VERIFIER" },
  { local: "protection.test", role: "staff", subRole: "protection_officer", fullName: "DEMO PROTECTION OFFICER" },
  { local: "grievance.test", role: "staff", subRole: "grievance_committee", fullName: "DEMO GRIEVANCE REVIEWER" }
] as const;

const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;

for (const demo of users) {
  const email = `${demo.local}@example.com`;
  const existing = listed.users.find((user) => user.email?.toLowerCase() === email);
  const metadata = { role: demo.role, demo: true };
  const authResult = existing
    ? await supabase.auth.admin.updateUserById(existing.id, { email, email_confirm: true, password, app_metadata: metadata })
    : await supabase.auth.admin.createUser({ email, email_confirm: true, password, app_metadata: metadata });
  if (authResult.error || !authResult.data.user) throw authResult.error ?? new Error(`Could not provision ${email}`);
  const userId = authResult.data.user.id;
  let ngoId: string | null = null;
  if (demo.role === "ngo") {
    const { data: ngo, error: ngoError } = await supabase.from("ngos").select("id").eq("display_name", "DEMO NGO ONE").maybeSingle();
    if (ngoError) throw ngoError;
    ngoId = ngo?.id ?? null;
  }
  const { error: profileError } = await supabase.from("profiles").upsert({ id: userId, role: demo.role, sub_role: demo.subRole, full_name: demo.fullName, language: "en", ngo_id: ngoId }, { onConflict: "id" });
  if (profileError) throw profileError;
  if (demo.role === "child") {
    const { error: childError } = await supabase.from("children").update({ user_id: userId }).eq("public_code", "C-1001");
    if (childError) throw childError;
  }
}

console.log("Demo users provisioned safely in DEMO_MODE.");
console.log(`Shared demo password (print once, store securely): ${password}`);
console.log(users.map((user) => `${user.local}@example.com`).join("\n"));
