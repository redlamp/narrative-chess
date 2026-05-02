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

export async function ensureUser(email: string, password: string) {
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
  return data.user;
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
  await page.waitForURL(`${baseURL}/`, { timeout: 10_000 });
  // Sanity: cookies on context are now set by the middleware.
  void context;
}
