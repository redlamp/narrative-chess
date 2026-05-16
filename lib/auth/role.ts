import { createClient } from "@/lib/supabase/server";

/**
 * Role tier values. Stored in profiles.role and gated by check constraint.
 * 'bot' has identical capabilities to 'player'; it exists as a tag for
 * targeted cleanup of e2e fixture accounts. See:
 *   wiki/notes/decision-role-storage-design.md
 */
export type Role = "player" | "admin" | "bot";

/**
 * Sole role-check surface used by app code. Calls public.has_role() RPC
 * which runs SECURITY DEFINER server-side and reads profiles.role.
 *
 * Use this in server actions, page guards, and middleware. Never read
 * profiles.role directly — the indirection layer is what lets us swap
 * storage shape (single column -> junction table) without touching
 * consumers when M2 narrative work needs additive roles.
 */
export async function hasRole(role: Role): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_role", { target: role });
  if (error) return false;
  return data === true;
}

/**
 * Returns the current user's role string, or null if unauthenticated.
 *
 * NOTE: This is the ONE allowed direct read of profiles.role, scoped to
 * the current user's own row (which RLS would let them read anyway via
 * profiles_select_authenticated). Use hasRole() for permission gates;
 * use currentRole() only when you actually need to render the role value
 * (e.g., debug banners or the user's own settings page).
 */
export async function currentRole(): Promise<Role | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  return (data?.role as Role) ?? null;
}
