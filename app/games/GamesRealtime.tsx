"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { subscribeToAllGameStatus } from "@/lib/realtime/subscribe";

type Props = {
  /** Authenticated viewer's user id. Used to gate "your game started" toasts
   *  to participants only. */
  viewerUserId: string;
};

/**
 * Mounts under /games and refreshes the server-rendered list whenever a
 * visible games row changes status. RLS already filters delivery to:
 *   - games where the viewer is a participant
 *   - games whose status is `open` (open lobby)
 *
 * Toasts on the participant-side open→in_progress transition; refreshes the
 * router on every observed status change so the four lists stay current
 * without a hard reload.
 */
export function GamesRealtime({ viewerUserId }: Props) {
  const router = useRouter();
  // Last-seen status per game id. Used to detect transitions and
  // suppress refreshes triggered by ply/fen-only updates within an
  // ongoing in_progress game.
  const lastStatus = useRef<Map<string, string>>(new Map());
  // Game ids we've already toasted on for the open→in_progress flip
  // this session. Prevents repeat toasts if Realtime redelivers.
  const toasted = useRef<Set<string>>(new Set());

  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    void subscribeToAllGameStatus((u) => {
      const prev = lastStatus.current.get(u.id);
      lastStatus.current.set(u.id, u.status);

      // Status unchanged (e.g., a move within an in_progress game): ignore.
      if (prev !== undefined && prev === u.status) return;

      const isParticipant =
        u.white_id === viewerUserId || u.black_id === viewerUserId;

      // Toast on participant-side open→in_progress flip. First-sight events
      // (prev === undefined) almost always represent a fresh transition the
      // subscription just observed, so we toast there too.
      if (
        u.status === "in_progress" &&
        isParticipant &&
        !toasted.current.has(u.id)
      ) {
        toasted.current.add(u.id);
        toast.success("Game started");
      }

      router.refresh();
    }).then((s) => {
      if (cancelled) s.unsubscribe();
      else sub = s;
    });

    return () => {
      cancelled = true;
      sub?.unsubscribe();
    };
  }, [router, viewerUserId]);

  return null;
}
