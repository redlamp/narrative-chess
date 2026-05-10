"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftToLine,
  ArrowRight,
  ArrowRightToLine,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { pairsFromMoves, stepPly, type MoveLike } from "@/lib/chess/move-list";
import { MoveCell } from "./MoveCell";

// Shared classes for the step buttons. Editorial mono micro-button
// style: thin rule, subtle hover, ink-faint when disabled. Visual
// size stays at h-6 (24px) so the editorial micro-button voice
// reads; a transparent ::before overlay extends the actual hit zone
// to ~44px (WCAG 2.5.5) for touch input. relative on the button +
// inset-0 absolute on the pseudo so it covers the button and bleeds
// outward via -m-2.5 (10px each side) without affecting layout.
const stepBtnClass = cn(
  "relative h-6 grid place-items-center rounded leading-none",
  "border border-rule-soft hover:bg-bg-soft transition-colors",
  "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent",
  "before:content-[''] before:absolute before:inset-0 before:-m-2.5 before:rounded",
);

type Props = {
  moves: MoveLike[];
  livePly: number;
  viewedPly: number | null;
  onScrub: (ply: number | null) => void;
  /**
   * Optional play-button handler. Invoked when the user clicks the
   * header-row Play button. GameClient binds this to a fixed-pace scrub
   * (1000ms/move) so playback feels paced for watching, vs. the
   * faster curve used by step buttons + cell clicks.
   */
  onPlay?: () => void;
  /**
   * True while a Play-initiated playback is in flight. Drives the
   * Play button's active (oxblood) styling so the user has a clear
   * visual signal that auto-advance is running.
   */
  isPlaying?: boolean;
};

export function MoveList({ moves, livePly, viewedPly, onScrub, onPlay, isPlaying = false }: Props) {
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

  // Desktop column-major grid. Pick a column count from the pair
  // count: ~20 pairs per column, capped at 3. Net effect:
  //   1-20  pairs -> 1 col   (panel 180px wide — title-row floor)
  //   21-40 pairs -> 2 cols  (panel 308px)
  //   41+   pairs -> 3 cols  (panel 460px, hard cap)
  // Rows-per-col follows from ceil(pairs / cols) so columns end up
  // balanced in length.
  const desktopColCount =
    pairs.length === 0
      ? 1
      : Math.min(3, Math.max(1, Math.ceil(pairs.length / 20)));
  const desktopRowCount =
    pairs.length === 0 ? 1 : Math.ceil(pairs.length / desktopColCount);

  // Explicit panel width derived from col count. We set this inline
  // (not via w-fit) so CSS can transition between the three stops
  // — w-fit / fit-content can't be transitioned, but a numeric
  // pixel width can. Floor at 180px so the 1-col case still has
  // room for the title row's "Move list" label + Play button
  // without truncation.
  const desktopPanelWidth = Math.max(
    180,
    desktopColCount * 140 + (desktopColCount - 1) * 12 + 16, // cols + gaps + px-2
  );

  // Step-button enabled-state derivations. atStart disables |◀/◀ when
  // we're already at ply 0; atLive disables ▶/▶| and Play when we're
  // already viewing the live position (viewedPly null OR equal to live).
  const atStart = activePly === 0;
  const atLive = viewedPly === null || viewedPly === livePly;

  const totalCells = pairs.reduce(
    (acc, p) => acc + 1 + (p.black ? 1 : 0),
    0,
  );

  // Per-cell entry delay using a quadratic decay on the inter-cell GAP:
  //
  //   gap(i) = startGap - (startGap - endGap) * (i / (N-2))^2
  //
  // gap(0) = 30ms  (delay between cell 0 and cell 1)
  // gap(N-2) = 5ms (delay between the last two cells)
  //
  // Each cell's absolute delay is the running sum of gaps before it,
  // so the early cascade feels lazy and the tail compresses. Closed-
  // form via the standard 1^2 + 2^2 + ... + (K-1)^2 = (K-1)K(2K-1)/6
  // identity to avoid a per-render loop.
  function staggerDelayMs(cellPos: number): number {
    if (cellPos <= 0 || totalCells <= 1) return 0;
    const startGap = 30;
    const endGap = 5;
    const m = Math.max(totalCells - 2, 1); // (N-2), guarded for N<=2
    const b = startGap - endGap; // 25
    const K = cellPos;
    const sumSquares = ((K - 1) * K * (2 * K - 1)) / 6;
    const delay = startGap * K - (b / (m * m)) * sumSquares;
    return Math.round(Math.max(0, delay));
  }

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Initial-mount baseline = how many cells were rendered at first paint.
  // SSR / first client paint: baseline=null, every cell is treated as
  // pre-baseline (gets a staggered delay from the curve). After hydration
  // the effect locks baseline to the rendered count; later cellPos values
  // (>= baseline) flag a fresh arrival, which the .move-cell-fresh CSS
  // override pins to delay 0 so it lands in lockstep with the piece tween.
  const [baseline, setBaseline] = useState<number | null>(null);
  useEffect(() => {
    setBaseline((prev) => {
      if (prev !== null) return prev;
      const root = containerRef.current;
      return root?.querySelectorAll(".move-cell").length ?? 0;
    });
  }, []);

  function isFreshCell(cellPos: number): boolean {
    return baseline !== null && cellPos >= baseline;
  }

  // Auto-scroll the *active* cell into view whenever it changes.
  // activePly = viewedPly ?? livePly, so both review-mode scrubs and
  // live arrivals (viewedPly null, livePly bumped) route through the
  // same path: keep the highlighted cell visible. block: "nearest"
  // means we only scroll when the cell is actually outside the
  // current viewport — no movement when already in view.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const target = root.querySelector<HTMLElement>(
      `.move-cell[data-ply="${activePly}"]`,
    );
    if (target) {
      // block + inline both "nearest" so an active cell that lives
      // off-screen vertically OR horizontally (multi-col layouts at
      // narrow viewports where col 2/3 are past the panel edge)
      // gets brought into view.
      target.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [activePly]);

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
    <div
      ref={containerRef}
      className="w-full min-[820px]:flex-1 min-[820px]:min-h-0"
      data-testid="move-list"
    >
      {/* Mobile: inline PGN ribbon. Wraps naturally. Reads like a score sheet. */}
      <div className="min-[820px]:hidden font-mono text-[13px] px-1 py-2">
        {/* Outer auto-fill grid wraps multiple pair-units per row. Each
            unit is a fixed [28px_1fr_1fr] sub-grid (number / white /
            black) so the column rhythm matches desktop. minmax(140px,
            1fr) lets the units stretch to fill the row; auto-fill
            packs as many as fit at the current width — 2 pairs per row
            on phones (~360px viewport), 3-4 on tablets near the 820
            breakpoint. */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-3 gap-y-1">
          {pairs.map((pair) => {
            const whitePos = mobileIdx++;
            const whiteFresh = isFreshCell(whitePos);
            const whiteDelay = whiteFresh ? 0 : staggerDelayMs(whitePos);
            const blackPos = pair.black ? mobileIdx++ : null;
            const blackFresh = blackPos !== null && isFreshCell(blackPos);
            const blackDelay =
              blackPos === null ? null : blackFresh ? 0 : staggerDelayMs(blackPos);
            return (
              <div
                className="grid grid-cols-[28px_1fr_1fr] gap-x-1 move-row"
                data-move-num={pair.moveNum}
                key={pair.moveNum}
              >
                <span className="font-mono text-[11px] text-ink-faint self-center text-right pr-1">
                  {pair.moveNum}.
                </span>
                <MoveCell
                  ply={pair.white.ply}
                  san={pair.white.san}
                  isActive={pair.white.ply === activePly}
                  side="white"
                  delayMs={whiteDelay}
                  isFresh={whiteFresh}
                  onSelect={onScrub}
                />
                {pair.black && blackDelay !== null ? (
                  <MoveCell
                    ply={pair.black.ply}
                    san={pair.black.san}
                    isActive={pair.black.ply === activePly}
                    side="black"
                    delayMs={blackDelay}
                    isFresh={blackFresh}
                    onSelect={onScrub}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop: header (title + play + step buttons) is non-scrolling,
          fixed at the top of the panel. Only the moves grid below scrolls
          — keeps controls always reachable as the list grows. Each move
          column gets a subtle low-alpha tint matching the side that played
          it (white wash for white moves, black wash for black moves) so the
          eye can scan column-by-column without changing text colour. */}
      <div
        className="hidden min-[820px]:flex min-[820px]:flex-col min-[820px]:h-full min-[820px]:overflow-hidden px-2 py-3 border border-rule-soft rounded-md bg-bg-soft/40 transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ width: `${desktopPanelWidth}px` }}
      >
        <div className="flex items-center justify-between mb-1.5 px-1">
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-faint font-bold">
            Move list
          </p>
          <button
            type="button"
            aria-label="Play through to current position"
            disabled={atLive && !isPlaying}
            onClick={() => (onPlay ? onPlay() : onScrub(null))}
            className={cn(
              "w-6",
              stepBtnClass,
              // Active-while-playing: swap to oxblood-on-cream so the
              // button reads as "engaged" and not just "hovered". Same
              // bg-accent / text-accent-foreground pair the active move
              // cell uses, keeps the editorial accent consistent.
              isPlaying &&
                "bg-accent text-accent-foreground border-accent hover:bg-accent",
            )}
          >
            <Play aria-hidden className="h-3 w-3" fill="currentColor" />
          </button>
        </div>
        {/* Step controls — ArrowLeftToLine (first), ArrowLeft (prev),
            ArrowRight (next), ArrowRightToLine (last). All route through
            the same onScrub callback the cells use, so multi-ply jumps
            (first/last from late-game) ride the same GSAP timeline +
            per-move tween budget. */}
        <div className="grid grid-cols-4 gap-1 mb-2 px-1">
          <button
            type="button"
            aria-label="First move"
            disabled={atStart}
            onClick={() => onScrub(0)}
            className={stepBtnClass}
          >
            <ArrowLeftToLine aria-hidden className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Previous move"
            disabled={atStart}
            onClick={() => onScrub(stepPly(viewedPly, -1, livePly))}
            className={stepBtnClass}
          >
            <ArrowLeft aria-hidden className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Next move"
            disabled={atLive}
            onClick={() => onScrub(stepPly(viewedPly, +1, livePly))}
            className={stepBtnClass}
          >
            <ArrowRight aria-hidden className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Latest move"
            disabled={atLive}
            onClick={() => onScrub(null)}
            className={stepBtnClass}
          >
            <ArrowRightToLine aria-hidden className="h-3 w-3" />
          </button>
        </div>
        {/* Scroll body: just the moves grid. flex-1 + min-h-0 lets it
            shrink to fit available height inside the flex-col panel
            while keeping the header above always visible. Falls back
            to overflow-y-auto if a very long game (60+ pairs across
            3 cols) exceeds the available panel height.

            Inner grid is column-major with explicit col + row counts
            derived from pairs.length. Items fill col 1 top-to-bottom
            for desktopRowCount rows, then col 2 starts, then col 3.
            Col count caps at 3 so the panel stays snug. */}
        <div className="flex-1 min-h-0 overflow-y-auto">
        <div
          className="grid gap-x-3 gap-y-1 grid-flow-col"
          style={{
            gridTemplateColumns: `repeat(${desktopColCount}, 140px)`,
            gridTemplateRows: `repeat(${desktopRowCount}, 28px)`,
          }}
        >
          {pairs.map((pair, idx) => {
            // Pair-units at index 0, desktopRowCount, 2*desktopRowCount
            // are the first row of each visual column under
            // grid-flow-col. Add a vertical hairline rule to all
            // *other* pair-units so the columns read as distinct
            // sections — editorial vertical rule, magazine-style. col 1
            // skips the rule (it sits flush against the panel padding).
            const isColStart = idx % desktopRowCount === 0;
            const whitePos = desktopIdx++;
            // Cells with cellPos >= baseline arrived AFTER first paint
            // (mid-game live arrivals — own optimistic + opponent
            // realtime). They drop the slide-up keyframe so they pop in
            // synchronously with the piece animation rather than reading
            // as "list updates after the piece lands".
            const whiteFresh = isFreshCell(whitePos);
            const whiteDelay = whiteFresh ? 0 : staggerDelayMs(whitePos);
            // Only advance the counter when black actually moved. During
            // white's turn the third grid column is left empty so we don't
            // imply black has moved; the column rhythm picks back up on the
            // next pair.
            const blackPos = pair.black ? desktopIdx++ : null;
            const blackFresh = blackPos !== null && isFreshCell(blackPos);
            const blackDelay =
              blackPos === null
                ? null
                : blackFresh
                  ? 0
                  : staggerDelayMs(blackPos);
            return (
              <div
                className={cn(
                  "grid grid-cols-[28px_1fr_1fr] gap-x-1 move-row",
                  // Vertical hairline rule on all pair-units except
                  // the first of each column. ml-1 + pl-2 keep the
                  // ruled cells visually balanced against unruled
                  // ones (col 1 sits flush against the panel padding).
                  // min-[820px]: scopes to desktop — the mobile
                  // auto-fill grid keeps its own rhythm.
                  !isColStart &&
                    "min-[820px]:border-l min-[820px]:border-rule-soft min-[820px]:ml-1 min-[820px]:pl-2",
                )}
                data-move-num={pair.moveNum}
                key={pair.moveNum}
              >
                <span className="font-mono text-[11px] text-ink-faint self-center text-right pr-1">
                  {pair.moveNum}.
                </span>
                <MoveCell
                  ply={pair.white.ply}
                  san={pair.white.san}
                  isActive={pair.white.ply === activePly}
                  side="white"
                  delayMs={whiteDelay}
                  isFresh={whiteFresh}
                  onSelect={onScrub}
                />
                {pair.black && blackDelay !== null ? (
                  <MoveCell
                    ply={pair.black.ply}
                    san={pair.black.san}
                    isActive={pair.black.ply === activePly}
                    side="black"
                    delayMs={blackDelay}
                    isFresh={blackFresh}
                    onSelect={onScrub}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
        </div>{/* end scroll body */}
      </div>{/* end desktop panel */}
    </div>
  );
}
