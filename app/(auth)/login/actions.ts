"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginState = { error?: string };

/**
 * Result shape for the no-redirect variant. The form decides what to do on
 * success (e.g. close a dialog and `router.push`).
 */
export type LoginResult =
  | { ok: true }
  | { ok: false; error: string };

async function attemptSignIn(formData: FormData): Promise<LoginResult> {
  const parsed = LoginInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Invalid email or password" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { ok: false, error: "Invalid email or password" };
  }

  return { ok: true };
}

/**
 * Page-shell variant: redirects to "/" on success. Used by /login.
 */
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const result = await attemptSignIn(formData);
  if (!result.ok) {
    return { error: result.error };
  }
  redirect("/");
}

/**
 * Dialog variant: returns a result instead of calling redirect(). The caller
 * (LoginForm wired through AuthDialog) closes the dialog and pushes the next
 * route on the client.
 */
export async function loginNoRedirect(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const result = await attemptSignIn(formData);
  if (!result.ok) {
    return { error: result.error };
  }
  return {};
}
