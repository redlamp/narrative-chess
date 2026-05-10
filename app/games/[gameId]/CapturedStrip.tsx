"use client";

import type { Piece } from "@/lib/chess/board-types";

type Props = {
  /** Pieces this side has captured, in display order (highest value first). */
  pieces: Piece[];
};

/**
 * Horizontal strip of small Taylor-piece icons that sits below the player's
 * name in their pill. Reacts to the *pill's* inline-size (not viewport)
 * because pill width is layout-driven: at vw=320 each side pill is ~110px,
 * at vw=900+ ~280px. Two CSS variables, --cap-icon and --cap-overlap, are
 * set by container-query utilities on the parent (@[width]/pill:...) and
 * consumed below for icon size + successor margin-left.
 *
 * Right edge fades into transparent via mask-image so any overflow at the
 * narrowest pill widths degrades to a soft fade instead of a hard mid-icon
 * clip on the pill's overflow-hidden boundary.
 *
 * Reserves a fixed-height row even when empty so the pill doesn't jitter
 * as captures land.
 */
export function CapturedStrip({ pieces }: Props) {
  return (
    <span
      aria-label={
        pieces.length === 0
          ? "no pieces captured"
          : `captured ${pieces.length} piece${pieces.length === 1 ? "" : "s"}`
      }
      className={[
        // Default (very narrow pill, < 140px content width):
        //   icon 20px, successor overlap -12px → 8 captures = 76px
        "[--cap-icon:20px] [--cap-overlap:-12px]",
        // 140px pill: icon 22, overlap -10 → 8 caps = 106px
        "@[140px]/pill:[--cap-icon:22px] @[140px]/pill:[--cap-overlap:-10px]",
        // 180px pill: icon 26, overlap -8 → 8 caps = 152px
        "@[180px]/pill:[--cap-icon:26px] @[180px]/pill:[--cap-overlap:-8px]",
        // 240px pill: icon 30, overlap -6 → 8 caps = 198px
        "@[240px]/pill:[--cap-icon:30px] @[240px]/pill:[--cap-overlap:-6px]",
        // 280px+ pill: icon 32, overlap -4 → 8 caps = 228px (full size)
        "@[280px]/pill:[--cap-icon:32px] @[280px]/pill:[--cap-overlap:-4px]",
        "block min-h-[24px] overflow-hidden",
      ].join(" ")}
      style={{
        // Soft fade on right edge so any unavoidable overflow (very narrow
        // pill + many captures) bleeds out gracefully rather than hard-
        // clipping mid-icon on the pill's overflow-hidden.
        maskImage:
          "linear-gradient(to right, black calc(100% - 12px), transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, black calc(100% - 12px), transparent)",
      }}
    >
      <span className="inline-flex items-center" style={{ paddingRight: 4 }}>
        {pieces.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- static SVG, see piece-set.tsx note
          <img
            key={`${p}-${i}`}
            src={`/pieces/taylor/${p[0]}${p[1].toLowerCase()}.svg`}
            alt={p}
            draggable={false}
            className="block opacity-90 pointer-events-none select-none"
            style={{
              width: "var(--cap-icon)",
              height: "var(--cap-icon)",
              // First icon snugs to name baseline (-2px); successors
              // overlap each other by --cap-overlap, set per pill width.
              marginLeft: i === 0 ? "-2px" : "var(--cap-overlap)",
            }}
          />
        ))}
      </span>
    </span>
  );
}
