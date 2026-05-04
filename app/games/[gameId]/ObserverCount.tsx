"use client";

import { useEffect, useState } from "react";
import { joinObserverPresence } from "@/lib/realtime/observer-presence";
import { registerObserver } from "./actions";

type Props = {
  gameId: string;
  myUserId: string;
  isObserver: boolean;
  initialTotal: number; // distinct-observer count from server hydration
};

export function ObserverCount({
  gameId,
  myUserId,
  isObserver,
  initialTotal,
}: Props) {
  const [total, setTotal] = useState(initialTotal);
  const [now, setNow] = useState(0);

  // On mount: if observer, register (idempotent) + refresh total from RPC.
  useEffect(() => {
    if (!isObserver) return;
    void registerObserver({ gameId }).then((r) => {
      if (r.ok) setTotal(r.count);
    });
  }, [gameId, isObserver]);

  // Presence channel — only observers join, so "now" is pure spectator count.
  useEffect(() => {
    if (!isObserver) return;
    let leaver: { leave: () => void } | null = null;
    let cancelled = false;
    void joinObserverPresence(gameId, myUserId, setNow).then((sub) => {
      if (cancelled) sub.leave();
      else leaver = sub;
    });
    return () => {
      cancelled = true;
      leaver?.leave();
    };
  }, [gameId, myUserId, isObserver]);

  // Render even for participants (so they see "X spectators total"); just
  // don't include the participant in the count via the RPC participant-skip.
  if (total === 0 && now === 0) return null;

  return (
    <div className="text-xs text-muted-foreground text-center max-w-xl mx-auto">
      <span aria-label={`${now} watching now, ${total} spectators total`}>
        {now} watching now · {total} spectators total
      </span>
    </div>
  );
}
