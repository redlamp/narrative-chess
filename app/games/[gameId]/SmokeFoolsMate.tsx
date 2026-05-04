"use client";

/**
 * Dev-only smoke button: drives the player's half of fool's mate
 * (`f3 e5 g4 Qh4#`) so two browsers can reach `black_won` checkmate
 * in a couple of seconds. Quick visual smoke for the terminal banner,
 * status pill, and observer count on game-end.
 *
 * Flow:
 * - White clicks → plays f2-f3 (ply 0 → 1). When realtime delivers
 *   black's e7-e5 (ply 1 → 2), plays g2-g4 (ply 2 → 3).
 * - Black clicks → waits for white's f2-f3 (ply 0 → 1) if not yet
 *   played, then plays e7-e5 (ply 1 → 2). When realtime delivers
 *   white's g2-g4 (ply 2 → 3), plays Qd8-h4# (ply 3 → 4).
 * - Observers don't see the button (handled by the parent).
 *
 * If the opponent plays anything other than the expected move, the
 * smoke breaks — that's fine for a dev tool. Happy-path verification
 * only.
 *
 * Visibility: gated on `process.env.NODE_ENV !== "production"`.
 * NODE_ENV is statically replaced at build time, so this whole module's
 * runtime code dead-code-eliminates in prod bundles.
 */

import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { makeMove } from "./actions";
import type { GameStatus } from "@/lib/schemas/game";

/**
 * Fool's mate move sequence in UCI (from-square + to-square + optional
 * promo char). Defined once, referenced by ply index below.
 *
 * Sequence:
 *   ply 0 → 1: white f2-f3
 *   ply 1 → 2: black e7-e5
 *   ply 2 → 3: white g2-g4
 *   ply 3 → 4: black d8-h4 (Qh4#)
 */
const FOOLS_MATE_UCI = ["f2f3", "e7e5", "g2g4", "d8h4"] as const;

/** Total number of moves in the sequence. */
const TOTAL_PLIES = FOOLS_MATE_UCI.length;

type Props = {
  gameId: string;
  myColor: "w" | "b";
  ply: number;
  status: GameStatus;
};

/** True when the given ply belongs to the side whose color is `color`. */
function isMyPly(ply: number, color: "w" | "b"): boolean {
  // ply 0 → white; ply 1 → black; ply 2 → white; ply 3 → black; ...
  return ply % 2 === (color === "w" ? 0 : 1);
}

export function SmokeFoolsMate({ gameId, myColor, ply, status }: Props) {
  // Once-armed flag so a click "joins" the sequence and subsequent
  // realtime updates auto-fire the player's next move. A ref (not
  // state) so the value is stable across renders without retriggering
  // the dispatch effect — the effect already keys on `ply`.
  const armedRef = useRef(false);

  // Per-ply guard so the dispatch effect only fires once per ply
  // transition, even if React re-runs the effect (e.g. on parent
  // re-render with the same ply). Without this, a click that races
  // a realtime tick could double-submit the same move.
  const dispatchedAtPlyRef = useRef<number | null>(null);

  const playPly = useCallback(
    async (plyIndex: number) => {
      const uci = FOOLS_MATE_UCI[plyIndex];
      if (!uci) return;
      // expectedPly matches the canonical (server-confirmed) ply from
      // the parent's state, which is exactly the ply BEFORE this move
      // lands. The make_move RPC's optimistic-concurrency check uses
      // it to reject if another move snuck in.
      const result = await makeMove({ gameId, uci, expectedPly: plyIndex });
      if (!result.ok) {
        // Idempotency: clicking the button twice in a row sends the
        // same move from the same expectedPly. The first call wins;
        // the second hits one of `concurrency_conflict`, `wrong_turn`,
        // or `illegal_move` (depending on whether the realtime tick
        // has reached us yet). All are graceful — log + disarm.
        if (
          result.code === "concurrency_conflict" ||
          result.code === "wrong_turn" ||
          result.code === "illegal_move"
        ) {
          console.warn(
            `[smoke] move ${uci} rejected (${result.code}) — disarming`,
          );
        } else {
          console.error(`[smoke] move ${uci} failed:`, result);
          toast.error(`Smoke failed at ${uci}: ${result.code}`);
        }
        // Disarm + clear dispatch guard so a fresh click can retry
        // (e.g. transient network error). The guard is per-ply, but
        // clearing here is harmless: a successful retry will re-set it.
        armedRef.current = false;
        dispatchedAtPlyRef.current = null;
      }
    },
    [gameId],
  );

  // Effect: when armed and it's our turn at a ply we own in the
  // sequence, dispatch the corresponding move. Re-keys on `ply` so
  // each realtime tick gets a chance to fire the next move.
  useEffect(() => {
    if (!armedRef.current) return;
    if (status !== "in_progress") return;
    if (ply >= TOTAL_PLIES) {
      // Sequence done (Qh4# was ply 3 → 4 = ply 4 here). Disarm so
      // a second click can re-arm if the user starts a new game in
      // the same tab.
      armedRef.current = false;
      return;
    }
    if (!isMyPly(ply, myColor)) return;
    if (dispatchedAtPlyRef.current === ply) return;

    dispatchedAtPlyRef.current = ply;
    void playPly(ply);
  }, [ply, status, myColor, playPly]);

  const onClick = useCallback(() => {
    armedRef.current = true;
    // Immediately dispatch if it's our turn now. The effect above
    // also handles this on the same tick, but calling here keeps the
    // click → first-move latency tight (no waiting for a re-render).
    if (
      status === "in_progress" &&
      ply < TOTAL_PLIES &&
      isMyPly(ply, myColor) &&
      dispatchedAtPlyRef.current !== ply
    ) {
      dispatchedAtPlyRef.current = ply;
      void playPly(ply);
    }
  }, [ply, status, myColor, playPly]);

  if (status !== "in_progress") return null;
  if (ply >= TOTAL_PLIES) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      title="Dev only — drives both clients through f3 e5 g4 Qh4# to reach black_won."
    >
      Smoke: fool&apos;s mate
    </Button>
  );
}
