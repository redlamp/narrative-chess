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
          className="block opacity-90 pointer-events-none select-none"
          style={{
            // Fluid overlap via clamp(). margin-left scales linearly
            // with viewport width between two stops, then floors /
            // caps at the extremes:
            //
            //   first icon (aligns to name baseline):
            //     vw=320 -> -12px   (deep overlap on phones)
            //     vw=640 ->  -8px   (editorial breathing room)
            //     vw=900+-> -4px    (just a hair tucked in)
            //   successor:
            //     vw=320 -> -20px   (very tight on phones)
            //     vw=640 -> -12px   (mid)
            //     vw=900+->  -8px   (wide ribbon)
            //
            // The slope expression is calc(intercept + slope*vw),
            // computed once per viewport size; clamp's min/max ensure
            // we never invert direction or overshoot.
            marginLeft:
              i === 0
                ? "clamp(-12px, calc(-16px + 1.25vw), -4px)"
                : "clamp(-20px, calc(-28px + 2.5vw), -8px)",
          }}
        />
      ))}
    </span>
  );
}
