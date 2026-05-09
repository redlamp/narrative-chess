"use client";

import { cn } from "@/lib/utils";

type Props = {
  ply: number;
  san: string;
  isActive: boolean;
  isRecent: boolean;
  onSelect: (ply: number) => void;
};

export function MoveCell({ ply, san, isActive, isRecent, onSelect }: Props) {
  return (
    <button
      type="button"
      data-ply={ply}
      data-recent={isRecent ? "" : undefined}
      onClick={() => onSelect(ply)}
      className={cn(
        "move-cell text-left px-2 py-1 font-mono text-[13px] tabular-nums transition-colors rounded-sm",
        isActive
          ? "bg-oxblood text-cream"
          : "text-foreground hover:bg-bg-soft",
      )}
    >
      {san}
    </button>
  );
}
