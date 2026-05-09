"use client";

import { useEffect, useMemo } from "react";
import { pairsFromMoves, stepPly, type MoveLike } from "@/lib/chess/move-list";
import { MoveCell } from "./MoveCell";

type Props = {
  moves: MoveLike[];
  livePly: number;
  viewedPly: number | null;
  onScrub: (ply: number | null) => void;
};

export function MoveList({ moves, livePly, viewedPly, onScrub }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t?.matches?.("input, textarea, [contenteditable]")) return;

      if (e.key === "ArrowLeft") {
        const next = stepPly(viewedPly, -1, livePly);
        onScrub(next === livePly ? null : next);
      } else if (e.key === "ArrowRight") {
        const next = stepPly(viewedPly, +1, livePly);
        onScrub(next === livePly ? null : next);
      } else if (e.key === "ArrowUp") {
        onScrub(0);
      } else if (e.key === "ArrowDown") {
        onScrub(null);
      } else {
        return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewedPly, livePly, onScrub]);

  const pairs = useMemo(() => pairsFromMoves(moves), [moves]);
  const activePly = viewedPly ?? livePly;
  const recentThreshold = Math.max(1, livePly - 7);

  if (moves.length === 0) {
    return (
      <div className="w-full max-w-xl mx-auto px-1 py-3">
        <p className="font-body italic text-ink-soft text-sm">No moves yet.</p>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-xl mx-auto px-1 py-2 max-h-72 overflow-y-auto"
      data-testid="move-list"
    >
      <div className="grid grid-cols-[40px_1fr_1fr] gap-x-2 gap-y-1">
        {pairs.map((pair) => (
          <div className="contents move-row" data-move-num={pair.moveNum} key={pair.moveNum}>
            <span className="font-mono text-[11px] text-ink-faint self-center text-right pr-1">
              {pair.moveNum}.
            </span>
            <MoveCell
              ply={pair.white.ply}
              san={pair.white.san}
              isActive={pair.white.ply === activePly}
              isRecent={pair.white.ply >= recentThreshold}
              onSelect={onScrub}
            />
            {pair.black ? (
              <MoveCell
                ply={pair.black.ply}
                san={pair.black.san}
                isActive={pair.black.ply === activePly}
                isRecent={pair.black.ply >= recentThreshold}
                onSelect={onScrub}
              />
            ) : (
              <span aria-hidden />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
