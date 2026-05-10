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
        // Icon size capped at 24px across all stops so the strip (and
        // therefore the pill) stays a constant height as pill width
        // grows. Only the *overlap* relaxes when there's room — at
        // wide pills icons spread out via smaller negative margin
        // rather than getting taller. h-[24px] (not min-h) locks the
        // row to one icon row regardless of viewport.
        // Default (very narrow pill, < 140px): 20px icon, -12px overlap → 76px @ 8
        "[--cap-icon:20px] [--cap-overlap:-12px]",
        // 140px pill: 22px / -10 → 106px @ 8
        "@[140px]/pill:[--cap-icon:22px] @[140px]/pill:[--cap-overlap:-10px]",
        // 180px pill: 24 / -8 → 136px @ 8
        "@[180px]/pill:[--cap-icon:24px] @[180px]/pill:[--cap-overlap:-8px]",
        // 240px pill: 24 / -6 → 150px @ 8 (icon ceiling reached, overlap relaxes)
        "@[240px]/pill:[--cap-icon:24px] @[240px]/pill:[--cap-overlap:-6px]",
        // 280px+ pill: 24 / -4 → 164px @ 8 (max breathing room)
        "@[280px]/pill:[--cap-icon:24px] @[280px]/pill:[--cap-overlap:-4px]",
        "block h-[24px] overflow-hidden",
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
