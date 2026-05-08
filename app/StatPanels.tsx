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

  const panels: Array<{ eyebrow: string; value: number; label: string }> = [
    { eyebrow: "Now playing", value: stats.active_games, label: "Live games on the boards at this hour." },
    { eyebrow: "Today", value: stats.games_played, label: "Games begun since this morning." },
    { eyebrow: "All accounts", value: stats.accounts, label: "Members who have signed up." },
  ];

  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-8 py-12 border-t-2 border-rule border-b border-rule">
      {panels.map((p) => (
        <div key={p.eyebrow} className="grid grid-cols-[auto_1fr] gap-4 items-baseline">
          <div className="font-mono font-semibold text-[56px] leading-[0.9] tracking-[-0.02em] text-oxblood tabular-nums">
            {p.value.toLocaleString()}
          </div>
          <div className="font-body italic text-[15px] leading-[1.4] text-ink-soft">
            <strong className="block font-mono not-italic font-medium text-[9px] tracking-[0.22em] uppercase text-foreground mb-1.5">
              {p.eyebrow}
            </strong>
            {p.label}
          </div>
        </div>
      ))}
    </section>
  );
}
