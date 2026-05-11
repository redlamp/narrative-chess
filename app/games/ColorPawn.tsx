/**
 * Tiny inline pawn icon used on open-invitation cards to mark which side the
 * inviter is playing. We reuse the Taylor SVG piece set rather than redrawing
 * so the colour treatment matches every other board on the site exactly.
 */

type Props = {
  color: "w" | "b";
  /** Pixel size. Defaults to 20. */
  size?: number;
  className?: string;
};

export function ColorPawn({ color, size = 20, className }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG asset, cached by CDN
    <img
      src={`/pieces/taylor/${color}p.svg`}
      alt={color === "w" ? "plays white" : "plays black"}
      width={size}
      height={size}
      draggable={false}
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", userSelect: "none" }}
    />
  );
}
