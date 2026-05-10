"use client";

import type { Piece } from "@/lib/chess/board-types";

type Props = {
  /** Pieces this side has captured, in display order (highest value first). */
  pieces: Piece[];
};

/**
 * Compact horizontal strip of small Cburnett-via-Taylor piece icons sitting
 * inline next to a player's name in their pill. Icons overlap by ~60% via
 * negative margin so a long capture list still fits in the pill width.
 */
export function CapturedStrip({ pieces }: Props) {
  if (pieces.length === 0) return null;
  return (
    <span
      aria-label={`captured ${pieces.length} piece${pieces.length === 1 ? "" : "s"}`}
      className="inline-flex items-center"
    >
      {pieces.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- static SVG, see piece-set.tsx note
        <img
          key={`${p}-${i}`}
          src={`/pieces/taylor/${p[0]}${p[1].toLowerCase()}.svg`}
          alt={p}
          width={14}
          height={14}
          draggable={false}
          className="block"
          style={{
            marginLeft: i === 0 ? 0 : -6,
            opacity: 0.85,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      ))}
    </span>
  );
}
