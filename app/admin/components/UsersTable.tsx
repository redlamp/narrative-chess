"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setRole } from "../actions";
import type { Role } from "@/lib/auth/role";

type User = {
  user_id: string;
  display_name: string;
  role: Role;
  email: string;
  created_at: string;
  games_played: number;
};

type Props = {
  users: User[];
  hideBots: boolean;
};

const ROLE_PILL: Record<Role, string> = {
  admin: "bg-oxblood/10 text-oxblood border-oxblood/40",
  player: "bg-foreground/5 text-foreground border-rule",
  bot: "bg-ink-soft/10 text-ink-soft border-ink-soft/30",
};

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function UsersTable({ users, hideBots }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const visible = hideBots ? users.filter((u) => u.role !== "bot") : users;

  const handleRoleChange = (userId: string, newRole: Role) => {
    setPending(userId);
    startTransition(async () => {
      try {
        await setRole(userId, newRole);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed";
        alert(`Role change failed: ${message}`);
      } finally {
        setPending(null);
      }
    });
  };

  const toggleHref = hideBots ? "/admin?show_bots=1" : "/admin";
  const toggleLabel = hideBots ? "Show bots" : "Hide bots";

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl text-foreground">Users</h2>
        <Link
          href={toggleHref}
          className="font-mono text-[10px] uppercase tracking-widest text-ink-soft hover:text-foreground"
          scroll={false}
        >
          {toggleLabel}
        </Link>
      </div>

      <div className="border border-rule rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-left">
            <tr>
              <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-soft">
                Display name
              </th>
              <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-soft">
                Email
              </th>
              <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-soft">
                Role
              </th>
              <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-soft">
                Joined
              </th>
              <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-soft text-right">
                Games
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  {hideBots && users.some((u) => u.role === "bot")
                    ? "No human users yet. Toggle 'Show bots' to see fixture accounts."
                    : "No users."}
                </td>
              </tr>
            ) : (
              visible.map((u) => (
                <tr key={u.user_id} className="hover:bg-foreground/[0.02]">
                  <td className="px-3 py-2">{u.display_name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {u.email}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={u.role}
                      onChange={(e) =>
                        handleRoleChange(u.user_id, e.target.value as Role)
                      }
                      disabled={pending === u.user_id}
                      className={`px-2 py-1 text-xs rounded border ${ROLE_PILL[u.role]} font-mono uppercase tracking-wider disabled:opacity-50 bg-background`}
                    >
                      <option value="player">player</option>
                      <option value="admin">admin</option>
                      <option value="bot">bot</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {u.games_played}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Admins can&apos;t demote themselves; the change will be rejected.
      </p>
    </section>
  );
}
