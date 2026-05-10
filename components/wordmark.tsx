import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

type Props = {
  className?: string;
  size?: "sm" | "md";
  layout?: "1-line" | "2-line";
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
  const isOneLine = layout === "1-line";

  return (
    <span
      className={cn(
        "inline-flex leading-none align-middle",
        isOneLine ? "flex-row items-center" : "flex-col items-end",
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
