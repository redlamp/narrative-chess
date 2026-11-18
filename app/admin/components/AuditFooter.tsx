type AuditRow = {
  id: string;
  actor_id: string;
  action: string;
  target_count: number;
  details: unknown;
  created_at: string;
};

type Props = {
  audit: AuditRow[];
  actorEmailById: Record<string, string>;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

const ACTION_LABEL: Record<string, string> = {
  nuke_all_games: "Deleted all games",
  nuke_all_bots: "Deleted all bot accounts",
  nuke_all_non_admin_users: "Deleted all non-admin users",
};

export function AuditFooter({ audit, actorEmailById }: Props) {
  return (
    <section className="space-y-3 pt-6 border-t border-rule">
      <h2 className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
        Recent admin actions
      </h2>

      {audit.length === 0 ? (
        <p className="text-xs text-muted-foreground">No admin actions yet.</p>
      ) : (
        <ul className="text-xs divide-y divide-rule border border-rule rounded">
          {audit.map((row) => (
            <li key={row.id} className="px-3 py-2 flex justify-between gap-3">
              <span>
                <span className="font-medium">
                  {ACTION_LABEL[row.action] ?? row.action}
                </span>{" "}
                <span className="text-muted-foreground">
                  ({row.target_count} target{row.target_count === 1 ? "" : "s"})
                </span>
              </span>
              <span className="text-muted-foreground font-mono">
                {actorEmailById[row.actor_id] ?? row.actor_id.slice(0, 8)} ·{" "}
                {formatDateTime(row.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
