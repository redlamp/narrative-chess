import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

type GameRow = {
  id: string;
  status: string;
  ply: number;
  white_id: string | null;
  black_id: string | null;
  created_at: string;
  white_name: string | null;
  black_name: string | null;
};

export default async function GamesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/games");

  const uid = user.id;
  const baseSelect = `
    id, status, ply, white_id, black_id, created_at,
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
    supabase
      .from("games")
      .select(baseSelect)
      .eq("status", "open")
      .not("white_id", "eq", uid)
      .not("black_id", "eq", uid)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("games")
      .select(baseSelect)
      .in("status", ["white_won", "black_won", "draw", "aborted"])
      .or(`white_id.eq.${uid},black_id.eq.${uid}`)
      .order("created_at", { ascending: false })
      .limit(20),
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
    <main className="container mx-auto max-w-4xl py-12 px-6 space-y-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-semibold">Games</h1>
        <Button asChild>
          <Link href="/games/new">Start new game</Link>
        </Button>
      </header>

      <Section
        title="Your active games"
        rows={myActive}
        viewer={uid}
        emptyHint="No games in progress."
      />
      <Section
        title="Your open challenges"
        rows={myOpen}
        viewer={uid}
        emptyHint="None — start one above."
      />
      <Section
        title="Other players' open challenges"
        rows={otherOpen}
        viewer={uid}
        emptyHint="No open challenges right now."
      />
      <Section
        title="Your completed games"
        rows={myCompleted}
        viewer={uid}
        emptyHint="No completed games yet."
      />
    </main>
  );
}

function Section({
  title,
  rows,
  viewer,
  emptyHint,
}: {
  title: string;
  rows: GameRow[];
  viewer: string;
  emptyHint: string;
}) {
  return (
    <section>
      <h2 className="text-sm uppercase tracking-wide text-muted-foreground mb-3">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((g) => (
            <li key={g.id}>
              <Link
                href={`/games/${g.id}`}
                className="block rounded border p-3 hover:bg-muted/40 transition-colors"
              >
                <GameRowRender row={g} viewer={viewer} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GameRowRender({ row, viewer }: { row: GameRow; viewer: string }) {
  const youWhite = row.white_id === viewer;
  const youBlack = row.black_id === viewer;
  const opponentName = youWhite
    ? row.black_name ?? "(open)"
    : youBlack
      ? row.white_name ?? "(open)"
      : `${row.white_name ?? "(open)"} vs ${row.black_name ?? "(open)"}`;
  const youColor = youWhite ? "white" : youBlack ? "black" : null;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium truncate">{opponentName}</p>
        <p className="text-xs text-muted-foreground">
          {statusLabel(row.status)} · ply {row.ply}
          {youColor ? ` · you play ${youColor}` : ""}
        </p>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">
        {new Date(row.created_at).toLocaleString()}
      </span>
    </div>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "in_progress":
      return "In progress";
    case "open":
      return "Open";
    case "white_won":
      return "White won";
    case "black_won":
      return "Black won";
    case "draw":
      return "Draw";
    case "aborted":
      return "Aborted";
    default:
      return status;
  }
}
