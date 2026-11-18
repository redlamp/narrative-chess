"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ResetRequestInput = z.object({
  email: z.string().email(),
});

export type ResetRequestState = { error?: string; sent?: boolean };

/**
 * Sends a Supabase password-recovery email. Always returns { sent: true }
 * on shape-valid input, regardless of whether the email matched a user —
 * avoids exposing an account-enumeration oracle.
 */
export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const parsed = ResetRequestInput.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email address" };
  }

  const supabase = await createClient();
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "narrative-chess.vercel.app";
  const redirectTo = `${proto}://${host}/auth/confirm?type=recovery`;

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo,
  });

  return { sent: true };
}

const NewPasswordInput = z.object({
  password: z.string().min(8).max(72),
});

export type NewPasswordState = { error?: string };

/**
 * Sets a new password. Requires the user to already have a recovery
 * session active (i.e., they followed a recovery email link, which the
 * /auth/confirm route exchanged for a session cookie).
 */
export async function setNewPassword(
  _prev: NewPasswordState,
  formData: FormData,
): Promise<NewPasswordState> {
  const parsed = NewPasswordInput.safeParse({
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Password must be 8–72 characters" };
  }

  const supabase = await createClient();
  const { data: session } = await supabase.auth.getUser();
  if (!session.user) {
    return { error: "Recovery session expired. Request a new reset link." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}
