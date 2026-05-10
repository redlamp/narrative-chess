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
          className="block"
          style={{
            marginLeft: i === 0 ? 0 : -8,
            opacity: 0.9,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      ))}
    </span>
  );
}
