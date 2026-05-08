import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * Featured live-game card. Pulls the most recent in-progress game and
 * shows player handles + status. Real-time updates are deferred — the
 * /games page handles that. This is just a magazine-style "Now playing"
 * teaser for the landing page.
 */
export async function LiveGameCard() {
  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select("id, status, created_at, white_id, black_id, time_control_type")
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!game) {
    return (
      <aside className="border border-rule bg-bg-soft mb-20 p-6 text-center font-body italic text-ink-soft">
        No games in progress at the moment.{" "}
        <Link href="/games/new" className="text-oxblood underline-offset-2 hover:underline">
          Begin one →
        </Link>
      </aside>
    );
  }

  // Look up display names for both sides if available.
  const ids = [game.white_id, game.black_id].filter((id): id is string => Boolean(id));
  let nameByUserId = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", ids);
    if (profiles) {
      nameByUserId = new Map(profiles.map((p) => [p.user_id, p.display_name ?? "anonymous"]));
    }
  }

  const whiteName = game.white_id ? nameByUserId.get(game.white_id) ?? "white" : "white";
  const blackName = game.black_id ? nameByUserId.get(game.black_id) ?? "black" : "open";
  const timeLabel = game.time_control_type ?? "untimed";

  return (
    <aside className="border border-rule bg-bg-soft mb-20 overflow-hidden">
      <div className="flex justify-between items-center px-4 py-2.5 border-b border-rule-soft font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft">
        <span className="text-foreground font-medium inline-flex items-center">
          <span className="inline-block size-[6px] bg-signal rounded-full mr-2 animate-pulse" />
          Live · Game {game.id.slice(0, 4)}
        </span>
        <span className="capitalize">{timeLabel}</span>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
          <div>
            <div className="font-display text-[22px] leading-[1.1]">{whiteName}</div>
            <div className="font-mono text-[10px] tracking-[0.1em] text-ink-faint mt-1 uppercase">White</div>
          </div>
          <div className="font-body italic text-sm text-ink-faint">vs</div>
          <div className="text-right">
            <div className="font-display text-[22px] leading-[1.1]">{blackName}</div>
            <div className="font-mono text-[10px] tracking-[0.1em] text-ink-faint mt-1 uppercase">Black</div>
          </div>
        </div>
      </div>
      <div className="px-4 py-2.5 border-t border-rule-soft text-right font-body italic text-[13px] text-ink-soft">
        <Link href={`/games/${game.id}`} className="text-oxblood hover:underline underline-offset-2">
          Watch →
        </Link>
      </div>
    </aside>
  );
}
