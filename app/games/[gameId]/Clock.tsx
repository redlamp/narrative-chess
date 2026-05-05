"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  computeRemaining,
  formatLive,
  formatCorrespondence,
  tickRateMs,
  type ClockMode,
} from "@/lib/chess/clock";

type Props = {
  side: "white" | "black";
  mode: ClockMode;
  remainingMs: number | null;
  turnStartedAt: string | null;
  isActive: boolean;
};

export function Clock({ side, mode, remainingMs, turnStartedAt, isActive }: Props) {
  const turnStartedAtMs = turnStartedAt ? new Date(turnStartedAt).getTime() : null;
  const [now, setNow] = useState<number>(() => Date.now());

  // Re-snap "now" when server pushes a new row (props change). Without
  // this, the displayed value lags by up to one tick after a move lands.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setNow(Date.now());
  }, [remainingMs, turnStartedAt, isActive]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (mode === "untimed" || remainingMs === null) return;
    const displayed = computeRemaining({
      remainingMs,
      turnStartedAtMs,
      nowMs: now,
      isActive,
    });
    const rate = tickRateMs(mode, displayed);
    if (rate === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), rate);
    return () => window.clearInterval(id);
  }, [mode, remainingMs, turnStartedAtMs, isActive, now]);

  if (mode === "untimed" || remainingMs === null) return null;

  const displayed = computeRemaining({
    remainingMs,
    turnStartedAtMs,
    nowMs: now,
    isActive,
  });

  const text =
    mode === "correspondence" ? formatCorrespondence(displayed) : formatLive(displayed);

  const lowTime = mode === "live" && displayed <= 30_000;

  return (
    <div
      className={cn(
        "rounded border px-3 py-2 font-mono text-lg tabular-nums text-center min-w-[88px]",
        isActive ? "ring-2 ring-amber-400" : "opacity-60",
        lowTime && isActive && "text-red-600 animate-pulse",
      )}
      data-testid="clock"
      data-side={side}
      data-active={isActive ? "true" : "false"}
      data-displayed-ms={displayed}
    >
      {text}
    </div>
  );
}
