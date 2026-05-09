"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
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

  // On initial mount, fade-up the last 8 cells with 50ms stagger.
  // Older cells render instantly so long games don't sweep for seconds.
  useGSAP(
    () => {
      const recentCells = containerRef.current?.querySelectorAll(
        ".move-cell[data-recent]",
      );
      if (!recentCells || recentCells.length === 0) return;
      gsap.from(recentCells, {
        opacity: 0,
        y: 8,
        duration: 0.2,
        stagger: 0.05,
        ease: "power2.out",
      });
    },
    { scope: containerRef, dependencies: [] },
  );

  // On new move arrival (moves.length increase), fade-up the newest cell.
  useGSAP(
    () => {
      const cells = containerRef.current?.querySelectorAll(".move-cell");
      if (!cells || cells.length === 0) return;
      const newest = cells[cells.length - 1];
      gsap.from(newest, {
        opacity: 0,
        y: 8,
        duration: 0.2,
        ease: "power2.out",
      });
    },
    { scope: containerRef, dependencies: [moves.length] },
  );

  // Auto-scroll latest move into view ONLY when not in review mode.
  // While scrubbed back, leave scroll position alone.
  useEffect(() => {
    if (viewedPly !== null) return;
    const cells = containerRef.current?.querySelectorAll(".move-cell");
    if (!cells || cells.length === 0) return;
    const newest = cells[cells.length - 1];
    newest.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [moves.length, viewedPly]);
  const recentThreshold = Math.max(1, livePly - 7);

  if (moves.length === 0) {
    return (
      <div className="w-full px-1 py-3">
        <p className="font-body italic text-ink-soft text-sm">No moves yet.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full" data-testid="move-list">
      {/* Mobile: inline PGN ribbon. Wraps naturally. Reads like a score sheet. */}
      <div className="lg:hidden font-mono text-[13px] leading-7 px-1 py-2 max-h-48 overflow-y-auto">
        {pairs.map((pair) => (
          <span key={pair.moveNum} className="move-row" data-move-num={pair.moveNum}>
            <span className="text-ink-faint">{pair.moveNum}.</span>
            <MoveCell
              ply={pair.white.ply}
              san={pair.white.san}
              isActive={pair.white.ply === activePly}
              isRecent={pair.white.ply >= recentThreshold}
              inline
              onSelect={onScrub}
            />
            {pair.black ? (
              <MoveCell
                ply={pair.black.ply}
                san={pair.black.san}
                isActive={pair.black.ply === activePly}
                isRecent={pair.black.ply >= recentThreshold}
                inline
                onSelect={onScrub}
              />
            ) : null}{" "}
          </span>
        ))}
      </div>

      {/* Desktop: two-column grid pinned to the side of the board. */}
      <div className="hidden lg:block px-2 py-3 max-h-[640px] overflow-y-auto border border-rule-soft rounded-md bg-bg-soft/40">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint mb-2 px-1">
          Move list
        </p>
        <div className="grid grid-cols-[32px_1fr_1fr] gap-x-2 gap-y-1">
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
    </div>
  );
}
