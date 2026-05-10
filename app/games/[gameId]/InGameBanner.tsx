"use client";

import { cn } from "@/lib/utils";
import type { GameStatus } from "@/lib/schemas/game";

type Props = {
  status: GameStatus;
  currentTurn: "w" | "b";
  ply: number;
  isObserver: boolean;
};

const NON_TERMINAL: GameStatus[] = ["open", "in_progress"];

function describe(
  status: GameStatus,
  currentTurn: "w" | "b",
  ply: number,
  isObserver: boolean,
): { eyebrow: string; title: string; subtitle: string } {
  if (status === "open") {
    return {
      eyebrow: "> waiting",
      title: "Waiting for opponent",
      subtitle: isObserver
        ? "The game starts when both seats are filled."
        : "Share this game URL to invite a player.",
    };
  }
  // in_progress
  const side = currentTurn === "w" ? "White" : "Black";
  return {
    eyebrow: "> turn",
    title: `${side} to move`,
    subtitle: `Ply ${ply}.`,
  };
}

/**
 * Status panel above the board during a live game. Mirrors the visual
 * shell of TerminalBanner so the same bordered "panel" frames the board
 * before, during, and after a match.
 *
 * Renders only on non-terminal statuses (`open`, `in_progress`); on
 * terminal statuses TerminalBanner takes over the same slot.
 */
export function InGameBanner({ status, currentTurn, ply, isObserver }: Props) {
  if (!NON_TERMINAL.includes(status)) return null;
  const { eyebrow, title, subtitle } = describe(status, currentTurn, ply, isObserver);

  return (
    <div
      className={cn(
        "max-w-xl mx-auto w-full rounded border border-foreground bg-foreground text-background p-4",
        "flex items-center justify-between gap-4",
      )}
      role="status"
    >
      <div className="min-w-0 space-y-1">
        <p className="font-mono uppercase tracking-wide text-[10px] text-signal">
          {eyebrow}
        </p>
        <h2 className="font-display text-lg truncate">{title}</h2>
        <p className="font-mono text-xs opacity-70 truncate">{subtitle}</p>
      </div>
    </div>
  );
}
