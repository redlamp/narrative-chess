"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type MoveEvent = {
  receivedAt: string;
  payloadType: "INSERT" | "UPDATE" | "DELETE" | "OTHER";
  newRow: unknown;
  oldRow: unknown;
};

export function RealtimeMonitor({ userId }: { userId: string }) {
  const [gameId, setGameId] = useState("");
  const [active, setActive] = useState(false);
  const [events, setEvents] = useState<MoveEvent[]>([]);
  const [status, setStatus] = useState<string>("idle");

  useEffect(() => {
    if (!active || !gameId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`diagnostic:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_moves",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          setEvents((prev) =>
            [
              {
                receivedAt: new Date().toISOString(),
                payloadType: (payload.eventType ??
                  "OTHER") as MoveEvent["payloadType"],
                newRow: payload.new,
                oldRow: payload.old,
              },
              ...prev,
            ].slice(0, 50),
          );
        },
      )
      .subscribe((s) => setStatus(`subscription: ${s}`));

    return () => {
      supabase.removeChannel(channel);
      setStatus("idle");
    };
  }, [active, gameId]);

  const hasOldRow = (e: MoveEvent) =>
    e.oldRow !== null &&
    typeof e.oldRow === "object" &&
    Object.keys(e.oldRow as Record<string, unknown>).length > 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="gameId" className="text-xs">
            game_id (uuid)
          </Label>
          <Input
            id="gameId"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            disabled={active}
            placeholder="00000000-0000-0000-0000-000000000000"
            className="font-mono text-xs"
          />
        </div>
        <Button
          type="button"
          size="lg"
          variant={active ? "outline" : "default"}
          onClick={() => setActive((v) => !v)}
          disabled={!gameId}
        >
          {active ? "Stop" : "Subscribe"}
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        userId for RLS: <code>{userId}</code>
        <br />
        Status: <code>{status}</code>
      </div>

      <div className="border border-border rounded p-3 max-h-96 overflow-auto">
        <p className="text-xs font-medium mb-2 text-foreground">
          Events ({events.length})
        </p>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No events yet. Insert a game_moves row in Supabase Studio.
          </p>
        ) : (
          <ul className="space-y-3 text-xs font-mono">
            {events.map((e, i) => (
              <li
                key={i}
                className="border-l-2 border-border pl-3 text-foreground"
              >
                <div className="text-muted-foreground">
                  {e.receivedAt} — {e.payloadType}
                </div>
                <pre className="text-[10px] mt-1 whitespace-pre-wrap break-all">
                  new = {JSON.stringify(e.newRow, null, 2)}
                </pre>
                {hasOldRow(e) ? (
                  <pre className="text-[10px] mt-1 whitespace-pre-wrap break-all">
                    old = {JSON.stringify(e.oldRow, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        <strong>Pass criteria:</strong> participant of the game (white_id or
        black_id matches your user_id) sees events with the inserted row&apos;s
        full data in <code>new</code>. Non-participant sees nothing (silence is
        correct). If a participant sees an event but <code>new</code> is
        empty/null, the Realtime publication is firing but RLS denied the
        SELECT — fix RLS before continuing.
      </p>
    </div>
  );
}
