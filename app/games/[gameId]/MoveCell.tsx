"use client";

import { cn } from "@/lib/utils";

type Props = {
  ply: number;
  san: string;
  isActive: boolean;
  isRecent: boolean;
  inline?: boolean;
  /**
   * Subtle column-tint hint for the desktop grid. "white" paints a low-alpha
   * white wash, "black" paints a low-alpha black wash. Suppressed while
   * active (the oxblood accent wins).
   */
  side?: "white" | "black";
  onSelect: (ply: number) => void;
};

export function MoveCell({ ply, san, isActive, isRecent, inline, side, onSelect }: Props) {
  return (
    <button
      type="button"
      data-ply={ply}
      data-recent={isRecent ? "" : undefined}
      onClick={() => onSelect(ply)}
      className={cn(
        "move-cell font-mono text-[13px] tabular-nums transition-colors rounded-sm",
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
