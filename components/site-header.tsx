import { createClient } from "@/lib/supabase/server";
import { SiteHeaderNav } from "./site-header-nav";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName: string | null = null;
  let currentGameId: string | null = null;

  if (user) {
    const [profileResult, lastMoveResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle(),
      // Find the in-progress game where this user most recently placed
      // a move. Drives the "Current" nav link so a player can jump
      // back to their active game from any page.
      supabase
        .from("game_moves")
        .select("game_id, played_at, games!inner(status)")
        .eq("played_by", user.id)
        .eq("games.status", "in_progress")
        .order("played_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    displayName = profileResult.data?.display_name ?? null;
    currentGameId = lastMoveResult.data?.game_id ?? null;

    // Fallback for participants in an in-progress game who haven't
    // played a move yet (joined as black before white opened, etc).
    if (!currentGameId) {
      const { data: fallback } = await supabase
        .from("games")
        .select("id")
        .eq("status", "in_progress")
        .or(`white_id.eq.${user.id},black_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      currentGameId = fallback?.id ?? null;
    }
  }

  return <SiteHeaderNav displayName={displayName} currentGameId={currentGameId} />;
}
