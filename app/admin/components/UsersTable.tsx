"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setRole, setRoleBulk } from "../actions";
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
  currentUserId: string;
};

const ROLE_PILL: Record<Role, string> = {
  admin: "bg-oxblood/10 text-oxblood border-oxblood/40",
  player: "bg-foreground/5 text-foreground border-rule",
  bot: "bg-ink-soft/10 text-ink-soft border-ink-soft/30",
};

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function UsersTable({ users, hideBots, currentUserId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState<Role>("player");
  const [, startTransition] = useTransition();
  const visible = useMemo(
    () => (hideBots ? users.filter((u) => u.role !== "bot") : users),
    [users, hideBots],
  );

  const selectableIds = useMemo(
    () => visible.filter((u) => u.user_id !== currentUserId).map((u) => u.user_id),
    [visible, currentUserId],
  );
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;

  const toggleOne = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (selectableIds.every((id) => prev.has(id))) return new Set();
      return new Set(selectableIds);
    });
  };

  const clearSelection = () => setSelected(new Set());

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

  const handleBulkApply = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const confirmed = window.confirm(
      `Change ${ids.length} user${ids.length === 1 ? "" : "s"} to role "${bulkRole}"?`,
    );
    if (!confirmed) return;
    setBulkPending(true);
    startTransition(async () => {
      try {
        await setRoleBulk(ids, bulkRole);
        clearSelection();
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed";
        alert(`Bulk role change failed: ${message}`);
      } finally {
        setBulkPending(false);
      }
    });
  };

  const toggleHref = hideBots ? "/admin?show_bots=1" : "/admin";
  const toggleLabel = hideBots ? "Show bots" : "Hide bots";
  const anyPending = bulkPending || pending !== null;

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

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 border border-rule rounded bg-foreground/[0.03] px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
            {selected.size} selected
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
            Change to
          </span>
          <select
            value={bulkRole}
            onChange={(e) => setBulkRole(e.target.value as Role)}
            disabled={bulkPending}
            className="px-2 py-1 text-xs rounded border border-rule font-mono uppercase tracking-wider bg-background disabled:opacity-50"
          >
            <option value="player">player</option>
            <option value="admin">admin</option>
            <option value="bot">bot</option>
          </select>
          <button
            type="button"
            onClick={handleBulkApply}
            disabled={bulkPending}
            className="px-3 py-1 text-xs rounded border border-oxblood/40 bg-oxblood/10 text-oxblood font-mono uppercase tracking-wider hover:bg-oxblood/20 disabled:opacity-50"
          >
            {bulkPending ? "Applying..." : "Apply"}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={bulkPending}
            className="px-2 py-1 text-xs rounded font-mono uppercase tracking-wider text-ink-soft hover:text-foreground disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      )}

      <div className="border border-rule rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-left">
            <tr>
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  disabled={selectableIds.length === 0 || anyPending}
                />
              </th>
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
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  {hideBots && users.some((u) => u.role === "bot")
                    ? "No human users yet. Toggle 'Show bots' to see fixture accounts."
                    : "No users."}
                </td>
              </tr>
            ) : (
              visible.map((u) => {
                const isSelf = u.user_id === currentUserId;
                return (
                  <tr key={u.user_id} className="hover:bg-foreground/[0.02]">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${u.display_name}`}
                        checked={selected.has(u.user_id)}
                        onChange={() => toggleOne(u.user_id)}
                        disabled={isSelf || anyPending}
                      />
                    </td>
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
                        disabled={pending === u.user_id || bulkPending}
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
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Admins can&apos;t demote themselves; the change will be rejected. Your row
        is non-selectable in bulk.
      </p>
    </section>
  );
}
