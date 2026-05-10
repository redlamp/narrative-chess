"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Initial-mount baseline. Animation index for each cell is its sequential
  // position MINUS this baseline. On SSR / first client paint, baseline is
  // null so cells receive their raw position (0..N-1) and stagger naturally.
  // After hydration, useEffect locks the baseline to the rendered cell count
  // so cells appended later (mid-game arrivals) receive an idx near 0,
  // avoiding a long stagger tail on the latest move. Held as state (not ref)
  // so render can read it without tripping react-hooks/refs.
  const [baseline, setBaseline] = useState<number | null>(null);
  useEffect(() => {
    setBaseline((prev) => {
      if (prev !== null) return prev;
      const root = containerRef.current;
      return root?.querySelectorAll(".move-cell").length ?? 0;
    });
  }, []);

  function staggerIdx(cellPos: number): number {
    if (baseline === null) return cellPos;
    return Math.max(0, cellPos - baseline);
  }

  // Auto-scroll latest move into view ONLY when not in review mode.
  // While scrubbed back, leave scroll position alone.
  useEffect(() => {
    if (viewedPly !== null) return;
    const cells = containerRef.current?.querySelectorAll(".move-cell");
    if (!cells || cells.length === 0) return;
    const newest = cells[cells.length - 1];
    newest.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [moves.length, viewedPly]);

  if (moves.length === 0) {
    return (
      <div className="w-full px-1 py-3">
        <p className="font-body italic text-ink-soft text-sm">No moves yet.</p>
      </div>
    );
  }

  // Walking counters for the desktop grid + mobile ribbon. Each cell's CSS
  // animation reads --cell-idx and applies animation-delay = idx * 30ms.
  // The animation rule lives in app/globals.css under @layer utilities so
  // the keyframe + descendant selector ship in the SSR'd CSS bundle and
  // run from first paint - no JS required.
  let desktopIdx = 0;
  let mobileIdx = 0;

  return (
    <div ref={containerRef} className="w-full" data-testid="move-list">
      {/* Mobile: inline PGN ribbon. Wraps naturally. Reads like a score sheet. */}
      <div className="lg:hidden font-mono text-[13px] leading-7 px-1 py-2 max-h-48 overflow-y-auto">
        {pairs.map((pair) => {
          const whiteIdx = staggerIdx(mobileIdx++);
          const blackIdx = pair.black ? staggerIdx(mobileIdx++) : null;
          return (
            <span key={pair.moveNum} className="move-row" data-move-num={pair.moveNum}>
              <span className="text-ink-faint">{pair.moveNum}.</span>
              <MoveCell
                ply={pair.white.ply}
                san={pair.white.san}
                isActive={pair.white.ply === activePly}
                inline
                staggerIdx={whiteIdx}
                onSelect={onScrub}
              />
              {pair.black && blackIdx !== null ? (
                <MoveCell
                  ply={pair.black.ply}
                  san={pair.black.san}
                  isActive={pair.black.ply === activePly}
                  inline
                  staggerIdx={blackIdx}
                  onSelect={onScrub}
                />
              ) : null}{" "}
            </span>
          );
        })}
      </div>

      {/* Desktop: two-column grid pinned to the side of the board. Each move
          column gets a subtle low-alpha tint matching the side that played
          it (white wash for white moves, black wash for black moves) so the
          eye can scan column-by-column without changing text colour. */}
      <div className="hidden lg:block px-2 py-3 max-h-[640px] overflow-y-auto border border-rule-soft rounded-md bg-bg-soft/40">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint font-bold mb-2 px-1">
          Move list
        </p>
        <div className="grid grid-cols-[28px_1fr_1fr] gap-x-1 gap-y-1">
          {pairs.map((pair) => {
            const whiteIdx = staggerIdx(desktopIdx++);
            // Only advance the counter when black actually moved. During
            // white's turn the third grid column is left empty so we don't
            // imply black has moved; the column rhythm picks back up on the
            // next pair.
            const blackIdx = pair.black ? staggerIdx(desktopIdx++) : null;
            return (
              <div className="contents move-row" data-move-num={pair.moveNum} key={pair.moveNum}>
                <span className="font-mono text-[11px] text-ink-faint self-center text-right pr-1">
                  {pair.moveNum}.
                </span>
                <MoveCell
                  ply={pair.white.ply}
                  san={pair.white.san}
                  isActive={pair.white.ply === activePly}
                  side="white"
                  staggerIdx={whiteIdx}
                  onSelect={onScrub}
                />
                {pair.black && blackIdx !== null ? (
                  <MoveCell
                    ply={pair.black.ply}
                    san={pair.black.san}
                    isActive={pair.black.ply === activePly}
                    side="black"
                    staggerIdx={blackIdx}
                    onSelect={onScrub}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
