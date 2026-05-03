"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GameStatus, TerminationReason } from "@/lib/schemas/game";

type Props = {
  status: GameStatus;
  terminationReason: TerminationReason | null;
  isObserver: boolean;
};

const TERMINAL: GameStatus[] = ["white_won", "black_won", "draw", "aborted"];

function describe(status: GameStatus, reason: TerminationReason | null): {
  title: string;
  subtitle: string;
} {
  if (status === "aborted") {
    return {
      title: "Game aborted",
      subtitle: "Started before the first move was made.",
    };
  }
  if (status === "draw") {
    const subtitle =
      reason === "stalemate"
        ? "By stalemate."
        : reason === "threefold"
          ? "By threefold repetition."
          : reason === "fifty_move"
            ? "By the fifty-move rule."
            : reason === "insufficient"
              ? "By insufficient material."
              : "Drawn.";
    return { title: "Draw", subtitle };
  }
  const winner = status === "white_won" ? "White" : "Black";
  const subtitle =
    reason === "checkmate"
      ? "By checkmate."
      : reason === "resignation"
        ? "By resignation."
        : "Game over.";
  return { title: `${winner} wins`, subtitle };
}

export function TerminalBanner({ status, terminationReason, isObserver }: Props) {
  const router = useRouter();
  if (!TERMINAL.includes(status)) return null;
  const { title, subtitle } = describe(status, terminationReason);

  return (
    <div
      className={cn(
        "max-w-xl mx-auto w-full rounded border bg-card p-4",
        "flex items-center justify-between gap-4",
      )}
      role="status"
    >
      <div className="min-w-0">
        <h2 className="text-lg font-heading font-semibold truncate">{title}</h2>
        <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
      </div>
      {!isObserver && (
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/games")}
          >
            Back to games
          </Button>
          <Button type="button" onClick={() => router.push("/games/new")}>
            Start new game
          </Button>
        </div>
      )}
    </div>
  );
}
