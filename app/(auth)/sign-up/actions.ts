"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const SignUpInput = z.object({
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
  | { ok: true }
  | { ok: false; error: string };

async function attemptSignUp(formData: FormData): Promise<SignUpResult> {
  const parsed = SignUpInput.safeParse({
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/**
 * Page-shell variant: redirects to "/" on success. Used by /sign-up.
 */
export async function signUp(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const result = await attemptSignUp(formData);
  if (!result.ok) {
    return { error: result.error };
  }
  redirect("/");
}

/**
 * Dialog variant: returns a result instead of calling redirect(). The caller
 * (SignUpForm wired through AuthDialog) closes the dialog and pushes the next
 * route on the client.
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
