import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS. Server-only.
 *
 * Use sparingly — only for operations that legitimately need to read or
 * write across all users (e.g., consuming an invite code at signup,
 * deleting an auth.users row, the cron timeout sweep).
 *
 * NEVER import this in a client component. NEVER pass the returned
 * client (or its key) to the browser.
 *
 * Reads from `process.env` directly because `lib/env` narrows to the
 * client schema in the browser bundle and TypeScript loses the
 * `SUPABASE_SERVICE_ROLE_KEY` property; on the server the value is
 * always present at runtime when this helper is called.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "createAdminClient: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set on the server",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
