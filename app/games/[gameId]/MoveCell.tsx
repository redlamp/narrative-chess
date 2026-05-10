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
   * Sequential entry-animation index. Drives the CSS keyframe stagger via
   * `--cell-idx` (read by .move-cell rule in globals.css). 0 = first to
   * animate.
   */
  staggerIdx?: number;
  /**
   * True when this cell arrived AFTER the initial render baseline locked
   * (i.e. an own optimistic move or an opponent's realtime move). Adds
   * the `move-cell-fresh` class so globals.css swaps in a faster, slide-
   * less keyframe — the cell pops alongside the piece animation rather
   * than sliding up after it.
   */
  isFresh?: boolean;
  onSelect: (ply: number) => void;
};

export function MoveCell({ ply, san, isActive, inline, side, staggerIdx, isFresh, onSelect }: Props) {
  return (
    <button
      type="button"
      data-ply={ply}
      onClick={() => onSelect(ply)}
      style={
        staggerIdx !== undefined
          ? ({ "--cell-idx": staggerIdx } as CSSProperties)
          : undefined
      }
      className={cn(
        "move-cell font-mono text-[13px] tabular-nums transition-colors rounded-sm",
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
      {san}
    </button>
  );
}
