"use client";

import type { Piece } from "@/lib/chess/board-types";

type Props = {
  /** Pieces this side has captured, in display order (highest value first). */
  pieces: Piece[];
};

/**
 * Horizontal strip of small Taylor-piece icons that sits below the player's
 * name in their pill. Icons stack to the RIGHT via negative left margin on
 * each successor so a long capture list compresses gracefully. Reserves a
 * fixed-height row even when empty so the pill height doesn't jitter as
 * captures land.
 */
export function CapturedStrip({ pieces }: Props) {
  return (
    <span
      aria-label={
        pieces.length === 0
          ? "no pieces captured"
          : `captured ${pieces.length} piece${pieces.length === 1 ? "" : "s"}`
      }
      className="inline-flex items-center min-h-[32px]"
    >
      {pieces.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- static SVG, see piece-set.tsx note
        <img
          key={`${p}-${i}`}
          src={`/pieces/taylor/${p[0]}${p[1].toLowerCase()}.svg`}
          alt={p}
          width={32}
          height={32}
          draggable={false}
          // First icon nudges left so the strip aligns with the
          // player-name baseline above (the SVG's transparent margin
          // would otherwise push it visually inset). Successors
          // overlap further to compress a long capture list.
          // Both negative margins increase as the viewport narrows so
          // captures fit on a single row inside the player pill on
          // phones — at sm+ they back off for breathing room.
          //   first:     -ml-3 (-12) below sm  -> -ml-2 (-8)  at sm+
          //   successor: -ml-4 (-16) below sm  -> -ml-3 (-12) at sm+
          className={
            i === 0
              ? "block opacity-90 pointer-events-none select-none -ml-3 sm:-ml-2"
              : "block opacity-90 pointer-events-none select-none -ml-4 sm:-ml-3"
          }
        />
      ))}
    </span>
  );
}
