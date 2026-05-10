import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

type Props = {
  className?: string;
  size?: "sm" | "md";
  /**
   * `1-line` — horizontal pairing, default for wide chrome (header).
   * `2-line` — stacked, "Narrative" above boxed CHESS.
   * `responsive` — stacked at narrow widths (<640px), horizontal at sm+.
   *   Use this when the wordmark sits in a layout that's tight on small
   *   screens but has room on desktop (the site header).
   */
  layout?: "1-line" | "2-line" | "responsive";
};

/**
 * Two-voice wordmark — italic Fraunces-style "Narrative" mark + boxed
 * blackletter "CHESS" mark, paired horizontally (1-line) or stacked (2-line).
 *
 * The two marks are rendered as SVG files masked over `bg-current`, so the
 * wordmark colour follows the parent's `text-*` token. Sizes match the
 * design system specs in Figma node `13:18`.
 *
 * @see public/brand/wordmark-narrative.svg
 * @see public/brand/wordmark-chess-bordered.svg
 */
export function Wordmark({
  className,
  size = "md",
  layout = "1-line",
}: Props) {
  const dims = SIZES[size];

  // Responsive layout uses Tailwind to flip flex direction at 820px
  // (the same breakpoint the game page uses to switch from single-
  // column board+list to two-column board|list). Below 820 we stack
  // (col, items-end); at 820+ we sit on a single line (row,
  // items-center). Gap is the same in both axes per the Figma
  // master, so a single `gap` style covers both.
  const layoutClass =
    layout === "1-line"
      ? "flex-row items-center"
      : layout === "2-line"
        ? "flex-col items-end"
        : "flex-col items-end min-[820px]:flex-row min-[820px]:items-center";

  return (
    <span
      className={cn(
        "inline-flex leading-none align-middle",
        layoutClass,
        className,
      )}
      style={{ gap: `${dims.gap}px` }}
      role="img"
      aria-label="Narrative Chess"
    >
      <span
        aria-hidden="true"
        className="block bg-current shrink-0"
        style={{
          width: `${dims.narrativeW}px`,
          height: `${dims.narrativeH}px`,
          ...maskStyle("/brand/wordmark-narrative.svg"),
        }}
      />
      <span
        aria-hidden="true"
        className="block bg-current shrink-0"
        style={{
          width: `${dims.borderW}px`,
          height: `${dims.borderH}px`,
          ...maskStyle("/brand/wordmark-chess-bordered.svg"),
        }}
      />
    </span>
  );
}

type Dims = {
  narrativeW: number;
  narrativeH: number;
  borderW: number;
  borderH: number;
  gap: number;
};

// Pixel values pulled from Figma node 13:18 (Wordmark master).
// Vertical gap between marks is 11px at md and ~3px at sm; horizontal
// 1-line gap matches.
const SIZES: Record<"sm" | "md", Dims> = {
  md: {
    narrativeW: 368.282,
    narrativeH: 69.84,
    borderW: 362,
    borderH: 89,
    gap: 11,
  },
  sm: {
    narrativeW: 99.312,
    narrativeH: 18.833,
    borderW: 97.618,
    borderH: 24,
    gap: 2.966,
  },
};

function maskStyle(url: string): CSSProperties {
  return {
    WebkitMaskImage: `url('${url}')`,
    WebkitMaskSize: "100% 100%",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskImage: `url('${url}')`,
    maskSize: "100% 100%",
    maskRepeat: "no-repeat",
    maskPosition: "center",
  };
}
