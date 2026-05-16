type Profile = {
  user_id: string;
  display_name: string;
  role: "player" | "admin" | "bot";
  created_at: string;
  email: string;
  games_played: number;
};

type Game = {
  id: string;
  status: string;
  created_at: string;
};

type InviteCode = {
  code: string;
  consumed_by: string | null;
  expires_at: string | null;
};

type Props = {
  users: Profile[];
  games: Game[];
  inviteCodes: InviteCode[];
  /** Server render time. Passed in to dodge the react-hooks/purity lint. */
  nowMs: number;
};

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export function StatsPanel({ users, games, inviteCodes, nowMs }: Props) {
  const weekAgo = nowMs - ONE_WEEK_MS;

  const adminCount = users.filter((u) => u.role === "admin").length;
  const playerCount = users.filter((u) => u.role === "player").length;
  const botCount = users.filter((u) => u.role === "bot").length;

  const statusCounts: Record<string, number> = {};
  for (const g of games) {
    statusCounts[g.status] = (statusCounts[g.status] ?? 0) + 1;
  }
  const signupsThisWeek = users.filter(
    (u) => new Date(u.created_at).getTime() >= weekAgo,
  ).length;
  const gamesThisWeek = games.filter(
    (g) => new Date(g.created_at).getTime() >= weekAgo,
  ).length;

  const unusedCodes = inviteCodes.filter(
    (c) =>
      c.consumed_by === null &&
      (c.expires_at === null || new Date(c.expires_at).getTime() > nowMs),
  ).length;

  // Recent signups (filter bots out — we care about real audience signal).
  const recentSignups = users
    .filter((u) => u.role !== "bot")
    .slice(0, 10);

  // Recent games (any role).
  const recentGames = [...games]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  return (
    <section className="space-y-6">
      <h2 className="font-display text-2xl text-foreground">Stats</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total users"
          value={users.length}
          sub={`${adminCount} admin · ${playerCount} player · ${botCount} bot`}
        />
        <StatCard
          label="Total games"
          value={games.length}
          sub={
            Object.entries(statusCounts)
              .map(([k, v]) => `${v} ${k}`)
              .join(" · ") || "—"
          }
        />
        <StatCard label="Signups (7d)" value={signupsThisWeek} />
        <StatCard
          label="Games started (7d)"
          value={gamesThisWeek}
          sub={`${unusedCodes} unused invite codes`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
            Recent signups (humans only)
          </h3>
          <ul className="text-sm divide-y divide-rule border border-rule rounded">
            {recentSignups.length === 0 ? (
              <li className="px-3 py-2 text-muted-foreground">No signups yet.</li>
            ) : (
              recentSignups.map((u) => (
                <li key={u.user_id} className="px-3 py-2 flex justify-between">
                  <span>
                    <span className="font-medium">{u.display_name}</span>{" "}
                    <span className="text-muted-foreground">· {u.email}</span>
                  </span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {formatDateTime(u.created_at)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
            Recent games
          </h3>
          <ul className="text-sm divide-y divide-rule border border-rule rounded">
            {recentGames.length === 0 ? (
              <li className="px-3 py-2 text-muted-foreground">No games yet.</li>
            ) : (
              recentGames.map((g) => (
                <li key={g.id} className="px-3 py-2 flex justify-between">
                  <a
                    href={`/games/${g.id}`}
                    className="font-mono text-xs hover:underline"
                  >
                    {g.id.slice(0, 8)}…
                  </a>
                  <span className="text-muted-foreground text-xs">
                    {g.status} · {formatDateTime(g.created_at)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="border border-rule rounded p-4 bg-background">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
        {label}
      </p>
      <p className="font-display text-4xl text-foreground mt-1">{value}</p>
      {sub ? (
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      ) : null}
    </div>
  );
}
