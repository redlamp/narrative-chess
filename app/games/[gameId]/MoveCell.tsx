"use client";

import { cn } from "@/lib/utils";

type Props = {
  ply: number;
  san: string;
  isActive: boolean;
  isRecent: boolean;
  inline?: boolean;
  onSelect: (ply: number) => void;
};

export function MoveCell({ ply, san, isActive, isRecent, inline, onSelect }: Props) {
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
          : "text-foreground hover:bg-bg-soft",
      )}
    >
      {san}
    </button>
  );
}
