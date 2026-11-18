"use client";

import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

type Props = {
  ply: number;
  san: string;
  isActive: boolean;
  inline?: boolean;
  /**
   * Subtle column-tint hint for the desktop grid. "white" paints a low-alpha
   * white wash, "black" paints a low-alpha black wash. Suppressed while
   * active (the oxblood accent wins).
   */
  side?: "white" | "black";
  /**
   * Absolute entry-animation delay in ms. Drives the CSS keyframe via
   * `--cell-delay` (read by the .move-cell rule in globals.css). The
   * caller computes this from a quadratic gap-decay curve so the early
   * cells stagger lazily and the tail compresses.
   */
  delayMs?: number;
  /**
   * True when this cell arrived AFTER the initial render baseline locked
   * (i.e. an own optimistic move or an opponent's realtime move). Adds
   * the `move-cell-fresh` class so globals.css swaps in a faster, slide-
   * less keyframe — the cell pops alongside the piece animation rather
   * than sliding up after it.
   */
  isFresh?: boolean;
  /**
   * Optional compact duration string (e.g. "5s", "2m", "3h", "1d"),
   * computed by MoveList from played_at deltas. Renders as faint mono
   * text below the SAN in block layout; suppressed in inline layout
   * (mobile ribbon). Null when the prior anchor isn't available
   * (typically ply 1).
   */
  duration?: string | null;
  onSelect: (ply: number) => void;
};

export function MoveCell({ ply, san, isActive, inline, side, delayMs, isFresh, duration, onSelect }: Props) {
  return (
    <button
      type="button"
      data-ply={ply}
      onClick={() => onSelect(ply)}
      style={
        delayMs !== undefined
          ? ({ "--cell-delay": `${delayMs}ms` } as CSSProperties)
          : undefined
      }
      className={cn(
        // No transition-colors on bg/text: scrubbing through plies via
        // playhead can advance several cells per second, and a fading
        // highlight blurs which cell is active. Instant on/off lets
        // the eye lock the playhead position immediately.
        "move-cell font-mono text-[13px] tabular-nums rounded-sm",
        isFresh && "move-cell-fresh",
        inline
          ? "inline-block px-1.5 py-0.5 mx-0.5 align-baseline"
          : "block text-left px-2 py-1",
        isActive
          ? "bg-accent text-accent-foreground"
          : cn(
              "text-foreground hover:bg-bg-soft",
              side === "white" && "bg-white/15",
              side === "black" && "bg-black/20",
            ),
      )}
    >
      <span>{san}</span>
      {!inline && duration ? (
        <span
          className={cn(
            "ml-1.5 font-mono text-[10px] tabular-nums align-baseline",
            isActive ? "text-accent-foreground/70" : "text-ink-faint",
          )}
        >
          {duration}
        </span>
      ) : null}
    </button>
  );
}
