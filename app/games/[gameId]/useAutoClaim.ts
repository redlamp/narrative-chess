"use client";

import { useEffect, useRef } from "react";
import { claimTimeout } from "./actions";
import { computeRemaining, type ClockMode } from "@/lib/chess/clock";

type Args = {
  gameId: string;
  mode: ClockMode;
  status: string;
  /** Opponent's stored remaining ms (the side currently to move that I'm waiting on). */
  opponentRemainingMs: number | null;
  /** turn_started_at as ISO string. */
  turnStartedAt: string | null;
  /** Whether the opponent is the active side (true if it's their turn, not mine). */
  opponentIsActive: boolean;
};

const DEBOUNCE_MS = 1_000;

export function useAutoClaim({
  gameId,
  mode,
  status,
  opponentRemainingMs,
  turnStartedAt,
  opponentIsActive,
}: Args) {
  const fired = useRef(false);

  useEffect(() => {
    if (status !== "in_progress") return;
    if (mode === "untimed") return;
    if (!opponentIsActive) return;
    if (opponentRemainingMs === null) return;

    fired.current = false;

    const check = () => {
      const turnStartedAtMs = turnStartedAt
        ? new Date(turnStartedAt).getTime()
        : null;
      const remaining = computeRemaining({
        remainingMs: opponentRemainingMs,
        turnStartedAtMs,
        nowMs: Date.now(),
        isActive: true,
      });
      if (remaining <= 0 && !fired.current) {
        fired.current = true;
        window.setTimeout(async () => {
          const result = await claimTimeout({ gameId });
          if (!result.ok && result.code === "not_yet_expired") {
            fired.current = false;
          }
        }, DEBOUNCE_MS);
      }
    };

    check();
    const id = window.setInterval(check, 500);
    return () => window.clearInterval(id);
  }, [gameId, mode, status, opponentRemainingMs, turnStartedAt, opponentIsActive]);
}
