import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Handles Supabase email-link callbacks (signup confirmation, password
 * recovery, magic link, email change). Exchanges the `token_hash` for a
 * session cookie and redirects to the appropriate next page.
 *
 * The Supabase email templates use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=/`
 * as their action URL.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as
    | "signup"
    | "magiclink"
    | "recovery"
    | "email_change"
    | null;
  const requestedNext = searchParams.get("next") ?? "/";

  // Default next-route override for recovery flow — always send people to the
  // new-password form, never wherever they came from.
  const next = type === "recovery" ? "/reset-password/new" : requestedNext;

  if (!token_hash || !type) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Missing token in confirmation link")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
