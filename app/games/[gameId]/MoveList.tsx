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
  const initRanRef = useRef(false);

  // Combined entry animation:
  // - First fire (mount): stagger every cell (real moves + the empty
  //   trailing-black placeholder when white has just played) by 10ms each.
  //   Long games animate longer; matches user spec "x*10ms stagger".
  // - Subsequent fires (livePly bump): animate the just-played cell. When
  //   white plays into a fresh row, also animate the empty black placeholder
  //   sitting beside it so the row appears as a unit, not half-poppy.
  useGSAP(
    () => {
      const root = containerRef.current;
      if (!root) return;
      const cells = Array.from(
        root.querySelectorAll(".move-cell, .move-cell-placeholder"),
      );
      if (cells.length === 0) return;

      if (!initRanRef.current) {
        initRanRef.current = true;
        gsap.from(cells, {
          opacity: 0,
          y: 8,
          duration: 0.2,
          stagger: 0.01,
          ease: "power2.out",
        });
        return;
      }

      // Per-arrival path
      if (livePly === 0) return;
      const newCell = root.querySelector(`.move-cell[data-ply="${livePly}"]`);
      const targets: Element[] = [];
      if (newCell) targets.push(newCell);
      if (livePly % 2 === 1) {
        // White just played into a fresh row; the placeholder span next
        // to it materialised at the same time. Animate them together.
        const placeholder = root.querySelector(".move-cell-placeholder");
        if (placeholder) targets.push(placeholder);
      }
      if (targets.length === 0) return;
      gsap.from(targets, {
        opacity: 0,
        y: 8,
        duration: 0.2,
        ease: "power2.out",
      });
    },
    { scope: containerRef, dependencies: [livePly, moves.length] },
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

      {/* Desktop: two-column grid pinned to the side of the board. Each move
          column gets a subtle low-alpha tint matching the side that played
          it (white wash for white moves, black wash for black moves) so the
          eye can scan column-by-column without changing text colour. */}
      <div className="hidden lg:block px-2 py-3 max-h-[640px] overflow-y-auto border border-rule-soft rounded-md bg-bg-soft/40">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint font-bold mb-2 px-1">
          Move list
        </p>
        <div className="grid grid-cols-[28px_1fr_1fr] gap-x-1 gap-y-1">
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
                side="white"
                onSelect={onScrub}
              />
              {pair.black ? (
                <MoveCell
                  ply={pair.black.ply}
                  san={pair.black.san}
                  isActive={pair.black.ply === activePly}
                  isRecent={pair.black.ply >= recentThreshold}
                  side="black"
                  onSelect={onScrub}
                />
              ) : (
                /* Reserve column space + paint the black tint so the
                   trailing-white-move row keeps the same column rhythm.
                   move-cell-placeholder participates in the entry tween
                   alongside the white cell. */
                <span aria-hidden className="move-cell-placeholder rounded-sm bg-black/20" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
