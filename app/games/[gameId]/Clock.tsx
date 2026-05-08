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
  // `now` stays null on SSR + first client render so the initial paint matches
  // the server (no interpolation yet). The mount effect below sets `now` to
  // Date.now() post-hydration, after which the tick interval keeps it fresh.
  const [now, setNow] = useState<number | null>(null);

  // Re-snap "now" on hydrate AND whenever server pushes new clock state.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setNow(Date.now());
  }, [remainingMs, turnStartedAt, isActive]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (mode === "untimed" || remainingMs === null) return;
    if (now === null) return;
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

  // Pre-hydration (now === null): render the stored remainingMs verbatim.
  // Server and client both compute this from the same prop, so the initial
  // HTML matches the post-hydrate first frame and React doesn't flag a
  // mismatch. Once `now` is set in the mount effect, subsequent renders use
  // the interpolated value.
  const displayed =
    now === null
      ? remainingMs
      : computeRemaining({
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
        "rounded border border-rule-soft px-3 py-2 font-mono text-lg tabular-nums text-center min-w-[88px]",
        isActive ? "ring-2 ring-foreground" : "opacity-60",
        lowTime && isActive && "text-signal animate-pulse",
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
