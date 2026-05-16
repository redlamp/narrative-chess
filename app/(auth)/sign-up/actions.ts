"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SignUpInput = z.object({
  // Crockford base32 alphabet: A-Z minus I/L/O/U, plus 2-9 (no 0, no 1).
  // Must match CODE_ALPHABET in app/admin/actions.ts::generateCode.
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-HJ-NP-Z2-9]{8}$/,
      "Invite code must be 8 characters (Crockford base32: A-Z minus I/L/O/U, plus 2-9)",
    ),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  displayName: z.string().min(1).max(60),
});

export type SignUpState = { error?: string };

/**
 * Result shape for the no-redirect variant. The form decides what to do on
 * success (e.g. close a dialog and `router.push`).
 */
export type SignUpResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

/**
 * Map a consume_invite_code Postgres exception to a tester-facing string.
 */
function consumeErrorMessage(raw: string): string {
  if (raw.includes("invalid_invite_code")) return "Invite code not recognized";
  if (raw.includes("invite_code_already_used")) return "Invite code already used";
  if (raw.includes("invite_code_expired")) return "Invite code expired";
  return "Invite code could not be validated";
}

async function attemptSignUp(formData: FormData): Promise<SignUpResult> {
  const parsed = SignUpInput.safeParse({
    inviteCode: formData.get("inviteCode"),
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { inviteCode, email, password, displayName } = parsed.data;

  // 1. Create the auth user (also fires the handle_new_user trigger -> profile row).
  const supabase = await createClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (signUpError || !signUpData.user) {
    return { ok: false, error: signUpError?.message ?? "Sign-up failed" };
  }

  const newUserId = signUpData.user.id;

  // 2. Consume the invite code in a service-role transaction. If this fails,
  //    roll back the half-created auth user so the code can be reused with a
  //    different email and the orphan profile doesn't linger.
  const admin = createAdminClient();
  const { error: consumeError } = await admin.rpc("consume_invite_code", {
    p_code: inviteCode,
    p_user_id: newUserId,
  });

  if (consumeError) {
    // Best-effort rollback. If this also fails, the orphan auth.users row
    // remains; future admin-tooling iteration can detect + sweep these.
    await admin.auth.admin.deleteUser(newUserId).catch(() => {
      /* swallow — primary error already captured */
    });
    return {
      ok: false,
      error: consumeErrorMessage(consumeError.message),
    };
  }

  return { ok: true, email };
}

/**
 * Page-shell variant: redirects to /auth/check-email on success.
 * Used by /sign-up. Email confirmation gate is enabled in Supabase, so the
 * tester needs to click the confirmation link before their session activates.
 */
export async function signUp(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const result = await attemptSignUp(formData);
  if (!result.ok) {
    return { error: result.error };
  }
  redirect(`/check-email?email=${encodeURIComponent(result.email)}`);
}

/**
 * Dialog variant: returns a result instead of calling redirect(). The caller
 * (SignUpForm wired through AuthDialog) closes the dialog and pushes the next
 * route on the client.
 *
 * Note: with email confirmation enabled the user cannot play immediately —
 * dialog callers should treat success the same as the page shell and route
 * the user to /auth/check-email instead of /games.
 */
export async function signUpNoRedirect(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const result = await attemptSignUp(formData);
  if (!result.ok) {
    return { error: result.error };
  }
  return {};
}
