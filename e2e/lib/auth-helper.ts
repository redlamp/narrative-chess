import type { BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  throw new Error(
    "auth-helper requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export async function ensureUser(email: string, password: string) {
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

export async function loginAs(
  context: BrowserContext,
  email: string,
  password: string,
  baseURL: string,
): Promise<void> {
  await ensureUser(email, password);

  const anon = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  const session = data.session;
  if (!session) throw new Error("no session returned from password grant");

  const url = new URL(baseURL);
  const cookieName = `sb-${url.hostname.replace(/\./g, "-")}-auth-token`;
  const cookieValue = JSON.stringify([
    session.access_token,
    session.refresh_token,
    null,
    null,
    null,
  ]);

  await context.addCookies([
    {
      name: cookieName,
      value: encodeURIComponent(cookieValue),
      domain: url.hostname,
      path: "/",
      httpOnly: false,
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
  ]);
}
