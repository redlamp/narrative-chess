"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRole, type Role } from "@/lib/auth/role";

/**
 * All server actions in this file gate on hasRole('admin'). The RPCs they
 * call also re-check has_role('admin') server-side — defense in depth.
 */

async function assertAdmin() {
  if (!(await hasRole("admin"))) {
    throw new Error("unauthorized");
  }
}

async function currentUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");
  return user.id;
}

// ---------------------------------------------------------------------------
// Role management
// ---------------------------------------------------------------------------

export async function setRole(targetUserId: string, newRole: Role) {
  await assertAdmin();
  const actorId = await currentUserId();

  // Self-protection: admin can promote themselves (no-op) but cannot demote.
  if (targetUserId === actorId && newRole !== "admin") {
    throw new Error("cannot_demote_self");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role: newRole })
    .eq("user_id", targetUserId);

  if (error) throw error;
  revalidatePath("/admin");
}

export async function setRoleBulk(
  targetUserIds: string[],
  newRole: Role,
): Promise<{ count: number }> {
  await assertAdmin();
  const actorId = await currentUserId();

  const ids = Array.from(new Set(targetUserIds)).filter((id) => id !== actorId);
  if (ids.length === 0) {
    return { count: 0 };
  }

  const admin = createAdminClient();

  // Audit row first, mirrors the nuke RPC pattern: if the audit insert fails
  // we bail before mutating profile rows.
  const { error: auditError } = await admin.from("admin_audit").insert({
    actor_id: actorId,
    action: "set_role_bulk",
    target_count: ids.length,
    details: {
      new_role: newRole,
      target_ids: ids,
    },
  });
  if (auditError) throw auditError;

  const { error } = await admin
    .from("profiles")
    .update({ role: newRole })
    .in("user_id", ids);
  if (error) throw error;

  revalidatePath("/admin");
  return { count: ids.length };
}

// ---------------------------------------------------------------------------
// Invite codes
// ---------------------------------------------------------------------------

/**
 * Crockford-style base32 alphabet (no I, L, O, U) — easier to read aloud
 * and copy without confusion. 8 chars = 32^8 = ~10^12 possibilities, more
 * than enough for closed-beta volume.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const CODE_LENGTH = 8;

function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

export async function createInviteCode(
  note: string,
  expiresInDays: number | null,
) {
  await assertAdmin();
  const actorId = await currentUserId();

  const admin = createAdminClient();
  const expiresAt =
    expiresInDays === null
      ? null
      : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  // Retry on PK collision (vanishingly rare with 30^8 keyspace, but harmless).
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { error } = await admin.from("invite_codes").insert({
      code,
      created_by: actorId,
      expires_at: expiresAt,
      note: note.trim().slice(0, 120) || null,
    });
    if (!error) {
      revalidatePath("/admin");
      return code;
    }
    lastError = error;
    if (!error.message.toLowerCase().includes("duplicate")) {
      throw error;
    }
  }
  throw lastError;
}

export async function revokeInviteCode(code: string) {
  await assertAdmin();
  // "Revoke" = mark consumed without a real user. Code stays in the table
  // for audit value. We use a sentinel NULL consumed_by + consumed_at=now
  // is ambiguous, so instead we set expires_at to now (the consume RPC
  // raises invite_code_expired which is the closest matching error).
  const admin = createAdminClient();
  const { error } = await admin
    .from("invite_codes")
    .update({ expires_at: new Date().toISOString() })
    .eq("code", code)
    .is("consumed_by", null);
  if (error) throw error;
  revalidatePath("/admin");
}

// ---------------------------------------------------------------------------
// Nuke actions
// ---------------------------------------------------------------------------

export async function nukeAllGames(): Promise<{ count: number }> {
  await assertAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_nuke_all_games");
  if (error) throw error;
  revalidatePath("/admin");
  return { count: data ?? 0 };
}

/**
 * Calls the DB RPC which deletes profile rows + game records, then loops
 * the returned uuids through auth.admin.deleteUser to finish removing
 * auth.users rows. Partial failures in the auth loop are reported in the
 * return shape but don't roll back the DB delete (orphan auth users with
 * no profile are detectable; orphan profiles with no auth user are not).
 */
async function nukeViaRpc(
  rpc: "admin_nuke_all_bots" | "admin_nuke_all_non_admin_users_db_only",
): Promise<{ count: number; failures: string[] }> {
  await assertAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(rpc);
  if (error) throw error;

  const targetIds: string[] = (data ?? []) as string[];
  if (targetIds.length === 0) {
    revalidatePath("/admin");
    return { count: 0, failures: [] };
  }

  const admin = createAdminClient();
  const failures: string[] = [];
  for (const id of targetIds) {
    const { error: delError } = await admin.auth.admin.deleteUser(id);
    if (delError) failures.push(`${id}: ${delError.message}`);
  }

  revalidatePath("/admin");
  return { count: targetIds.length, failures };
}

export async function nukeAllBots() {
  return nukeViaRpc("admin_nuke_all_bots");
}

export async function nukeAllNonAdminUsers() {
  return nukeViaRpc("admin_nuke_all_non_admin_users_db_only");
}
