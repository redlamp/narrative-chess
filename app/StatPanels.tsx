import { createClient } from "@/lib/supabase/server";

type Stats = {
  games_played: number;
  active_games: number;
  accounts: number;
};

async function fetchStats(): Promise<Stats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_stats").single();
  if (error || !data) {
    return { games_played: 0, active_games: 0, accounts: 0 };
  }
  const row = data as {
    games_played: number | string;
    active_games: number | string;
    accounts: number | string;
  };
  // Postgres bigint comes back as string from PostgREST; coerce to number.
  return {
    games_played: Number(row.games_played) || 0,
    active_games: Number(row.active_games) || 0,
    accounts: Number(row.accounts) || 0,
  };
}

export async function StatPanels() {
  const stats = await fetchStats();

  const panels: Array<{ value: number; label: string }> = [
    { value: stats.games_played, label: "Games played" },
    { value: stats.active_games, label: "Active games" },
    { value: stats.accounts, label: "Accounts" },
  ];

  return (
    <section className="relative z-10 mx-auto max-w-5xl px-4 pt-4 pb-16">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {panels.map((p) => (
          <div
            key={p.label}
            className="rounded-lg border bg-background/80 backdrop-blur px-6 py-8 text-center shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="font-heading text-4xl font-semibold tabular-nums tracking-tight">
              {p.value.toLocaleString()}
            </p>
            <p className="mt-1 text-sm uppercase tracking-wide text-muted-foreground">
              {p.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
