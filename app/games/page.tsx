import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { GamesRealtime } from "./GamesRealtime";
import { GamesLibrary } from "./GamesLibrary";
import type { GameRow } from "./GameBook";

/**
 * Library — listing of every game involving the viewer, plus open invitations
 * on the wall. Rendered as an editorial "catalogue room" with tabs for
 * Now Playing / Archive. The server component is responsible only for the
 * four parallel reads and the page chrome; tab state, entrance animation, and
 * hover previews live in `<GamesLibrary>` and its children.
 */
export default async function GamesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/games");

  const uid = user.id;
  const baseSelect = `
    id, status, ply, white_id, black_id, created_at,
    current_fen, termination_reason,
    time_control_type, time_initial_seconds, time_increment_seconds, time_per_move_seconds,
    white_name:white_id ( display_name ),
    black_name:black_id ( display_name )
  `;

  const [
    { data: myActiveRaw },
    { data: myOpenRaw },
    { data: otherOpenRaw },
    { data: myCompletedRaw },
  ] = await Promise.all([
    supabase
      .from("games")
      .select(baseSelect)
      .eq("status", "in_progress")
      .or(`white_id.eq.${uid},black_id.eq.${uid}`)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("games")
      .select(baseSelect)
      .eq("status", "open")
      .or(`white_id.eq.${uid},black_id.eq.${uid}`)
      .order("created_at", { ascending: false })
      .limit(20),
    // Open games where the viewer is NOT a participant. PostgREST's
    // `.not("col", "eq", uid)` returns false on NULL (NOT (NULL = uid) = NULL),
    // which would silently exclude rows where one side is unfilled — exactly
    // the rows we want here. Use OR with `.is.null` so NULL counts as
    // "not the viewer" on both sides.
    supabase
      .from("games")
      .select(baseSelect)
      .eq("status", "open")
      .or(`white_id.is.null,white_id.neq.${uid}`)
      .or(`black_id.is.null,black_id.neq.${uid}`)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("games")
      .select(baseSelect)
      .in("status", ["white_won", "black_won", "draw", "aborted"])
      .or(`white_id.eq.${uid},black_id.eq.${uid}`)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  function flatten(rows: unknown[] | null): GameRow[] {
    if (!rows) return [];
    return (
      rows as Array<
        GameRow & {
          white_name: { display_name: string } | null;
          black_name: { display_name: string } | null;
        }
      >
    ).map((r) => ({
      ...r,
      white_name: r.white_name?.display_name ?? null,
      black_name: r.black_name?.display_name ?? null,
    }));
  }

  const myActive = flatten(myActiveRaw);
  const myOpen = flatten(myOpenRaw);
  const otherOpen = flatten(otherOpenRaw);
  const myCompleted = flatten(myCompletedRaw);

  return (
    <main className="library-page relative">
      <GamesRealtime viewerUserId={uid} />

      {/* Atmospheric backdrop. Layered via three pseudo-effects:
            1. Outer paper-grain SVG noise (very low opacity)
            2. Radial vignette pulling toward bg-deep at edges
            3. Hairline gilt rule framing the central column
          All decorative, pointer-events-none, rendered behind content. */}
      <div className="library-backdrop pointer-events-none absolute inset-0 z-0" aria-hidden />

      <div className="relative z-10 mx-auto max-w-[1180px] px-6 lg:px-14 pt-12 pb-24">
        {/* Title block — editorial masthead style */}
        <header className="library-masthead mb-12">
          <p className="font-mono uppercase tracking-[0.32em] text-[11px] text-ink-faint mb-3">
            The Catalogue
          </p>
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <h1 className="font-display text-5xl lg:text-6xl leading-[0.95] tracking-tight text-foreground">
              Your{" "}
              <em
                className="font-display italic"
                style={{ color: "var(--oxblood)" }}
              >
                library
              </em>
              <span
                className="font-display italic text-ink-faint"
                style={{ fontSize: "0.5em" }}
              >
                .
              </span>
            </h1>
            <Button asChild size="lg" className="shrink-0">
              <Link href="/games/new">Begin a game</Link>
            </Button>
          </div>
          <p className="font-display italic text-ink-soft text-lg mt-4 max-w-prose">
            A reading room for every match — those underway, those open on the
            wall, and the bound volumes of games already finished.
          </p>
        </header>

        <GamesLibrary
          viewer={uid}
          myActive={myActive}
          myOpen={myOpen}
          otherOpen={otherOpen}
          myCompleted={myCompleted}
        />
      </div>
    </main>
  );
}
