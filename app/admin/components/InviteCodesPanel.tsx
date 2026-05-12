"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createInviteCode, revokeInviteCode } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InviteCode = {
  code: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  consumed_by: string | null;
  consumed_at: string | null;
  note: string | null;
};

type Props = {
  codes: InviteCode[];
  userEmailById: Map<string, string>;
  /** Server render time. Used for expiry detection without calling Date.now()
   *  in render (lint rule react-hooks/purity).  */
  nowMs: number;
};

type Filter = "all" | "unused" | "used" | "expired";

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function statusOf(
  code: InviteCode,
  nowMs: number,
): "unused" | "used" | "expired" {
  if (code.consumed_by) return "used";
  if (code.expires_at && new Date(code.expires_at).getTime() <= nowMs) {
    return "expired";
  }
  return "unused";
}

export function InviteCodesPanel({ codes, userEmailById, nowMs }: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [expiresIn, setExpiresIn] = useState<"never" | "7" | "30">("30");
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();
  const [lastCreated, setLastCreated] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (filter === "all") return codes;
    return codes.filter((c) => statusOf(c, nowMs) === filter);
  }, [codes, filter, nowMs]);

  const handleGenerate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const days =
      expiresIn === "never" ? null : Number.parseInt(expiresIn, 10);
    startTransition(async () => {
      try {
        const code = await createInviteCode(note, days);
        setLastCreated(code);
        setNote("");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed";
        alert(`Code generation failed: ${message}`);
      }
    });
  };

  const handleRevoke = (code: string) => {
    if (!confirm(`Revoke invite code ${code}?`)) return;
    startTransition(async () => {
      try {
        await revokeInviteCode(code);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed";
        alert(`Revoke failed: ${message}`);
      }
    });
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {
      /* no-op */
    });
  };

  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl text-foreground">Invite codes</h2>

      <form
        onSubmit={handleGenerate}
        className="border border-rule rounded p-4 space-y-3 bg-background"
      >
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <div className="space-y-2">
            <Label htmlFor="note">Note (who&apos;s it for)</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={120}
              placeholder="e.g. for Sarah"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expires">Expires</Label>
            <select
              id="expires"
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value as "never" | "7" | "30")}
              className="h-9 px-3 rounded border border-input bg-background text-sm"
            >
              <option value="30">30 days</option>
              <option value="7">7 days</option>
              <option value="never">Never</option>
            </select>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Generating..." : "Generate code"}
          </Button>
        </div>
        {lastCreated ? (
          <p className="text-sm">
            Created{" "}
            <button
              type="button"
              onClick={() => copyToClipboard(lastCreated)}
              className="font-mono text-base tracking-widest text-oxblood hover:underline"
              title="Click to copy"
            >
              {lastCreated}
            </button>{" "}
            — click to copy.
          </p>
        ) : null}
      </form>

      <div className="flex items-center gap-2">
        {(["all", "unused", "used", "expired"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border ${
              filter === f
                ? "border-foreground text-foreground"
                : "border-rule text-ink-soft hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">
          {visible.length} of {codes.length}
        </span>
      </div>

      <div className="border border-rule rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-left">
            <tr>
              <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-soft">
                Code
              </th>
              <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-soft">
                Note
              </th>
              <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-soft">
                Status
              </th>
              <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-soft">
                Consumed by
              </th>
              <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-soft text-right">
                Created / Expires
              </th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No codes match this filter.
                </td>
              </tr>
            ) : (
              visible.map((c) => {
                const st = statusOf(c, nowMs);
                return (
                  <tr key={c.code} className="hover:bg-foreground/[0.02]">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(c.code)}
                        className="font-mono tracking-widest hover:text-oxblood"
                        title="Click to copy"
                      >
                        {c.code}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {c.note ?? <span className="opacity-50">—</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs uppercase tracking-wider">
                      {st}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {c.consumed_by
                        ? userEmailById.get(c.consumed_by) ?? "(deleted user)"
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                      {formatDate(c.created_at)}
                      {c.expires_at ? ` → ${formatDate(c.expires_at)}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {st === "unused" ? (
                        <button
                          type="button"
                          onClick={() => handleRevoke(c.code)}
                          disabled={pending}
                          className="text-xs text-oxblood hover:underline disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
