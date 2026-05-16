import type { BrowserContext, Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireEnv() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    throw new Error(
      "auth-helper requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return { SUPABASE_URL, SERVICE_ROLE_KEY, ANON_KEY };
}

let _admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const { SUPABASE_URL, SERVICE_ROLE_KEY } = requireEnv();
  _admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return _admin;
}

export type Role = "player" | "admin" | "bot";

/**
 * Crockford-style base32 alphabet (no I/L/O/U). Matches app/admin/actions.ts.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
function generateInviteCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/**
 * Idempotent test-user creator. Returns the existing user untouched if one
 * with this email already exists (role NOT modified — see note below);
 * otherwise creates a fresh user with `role` set on the profile row.
 *
 * **Default role: 'bot'** so accumulated CI runs can be wiped via /admin
 * "Delete all bot accounts" without affecting real testers. Override with
 * `{ role: 'player' }` for tests that need a non-bot tester (e.g.,
 * verifying that /admin rejects players).
 *
 * NOTE: Taylor's admin role is set by the seed_first_admin migration. If
 * ensureUser creates Taylor before the seed migration runs (fresh DB),
 * Taylor will be 'bot'; promote via `promoteToAdmin(user.id)` if needed.
 */
export async function ensureUser(
  email: string,
  password: string,
  opts: { role?: Role } = {},
) {
  const role = opts.role ?? "bot";
  const admin = getAdmin();
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list.users.find((u) => u.email === email);
  if (existing) return existing;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: email.split("@")[0] },
  });
  if (error) throw error;
  const user = data.user;

  // The handle_new_user trigger has already inserted the profile row. Update
  // its role to match the requested tier.
  if (user) {
    const { error: roleError } = await admin
      .from("profiles")
      .update({ role })
      .eq("user_id", user.id);
    if (roleError) throw roleError;
  }
  return user;
}

/**
 * Force-promote a user to admin via service-role profile update. Used to
 * seed admin-only e2e specs without depending on the seed migration UUID.
 */
export async function promoteToAdmin(userId: string): Promise<void> {
  const admin = getAdmin();
  const { error } = await admin
    .from("profiles")
    .update({ role: "admin" })
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Force-set a user to any role. Used by tests that need to flip a fixture
 * account between player/bot/admin between assertions.
 */
export async function setRoleFor(userId: string, role: Role): Promise<void> {
  const admin = getAdmin();
  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Insert an invite code via service-role (bypasses RLS). Returns the code
 * string. Use this when an admin-context test needs an unused code to
 * consume.
 */
export async function ensureInviteCode(
  createdBy: string,
  opts: { note?: string; expiresInDays?: number | null } = {},
): Promise<string> {
  const admin = getAdmin();
  const code = generateInviteCode();
  const expiresAt =
    opts.expiresInDays == null
      ? null
      : new Date(Date.now() + opts.expiresInDays * 86_400_000).toISOString();
  const { error } = await admin.from("invite_codes").insert({
    code,
    created_by: createdBy,
    expires_at: expiresAt,
    note: opts.note ?? "e2e fixture",
  });
  if (error) throw error;
  return code;
}

/**
 * Logs in a user by driving the actual login form in the browser. The
 * @supabase/ssr middleware writes its own cookies on the response, so this
 * sidesteps having to know the (project-ref + chunked-base64) cookie format.
 *
 * Caller passes a page (typically `await context.newPage()` ahead of time so
 * other actions are also gated). Returns once login redirects to `/`.
 */
export async function loginAs(
  context: BrowserContext,
  page: Page,
  email: string,
  password: string,
  baseURL: string,
): Promise<void> {
  await ensureUser(email, password);

  await page.goto(`${baseURL}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${baseURL}/`, { timeout: 30_000 });
  // Sanity: cookies on context are now set by the middleware.
  void context;
}
