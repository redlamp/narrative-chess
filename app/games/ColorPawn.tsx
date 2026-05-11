/**
 * Tiny inline piece icon used on book cards. Defaults to a pawn (open-invite
 * cards mark the inviter's side with one); archive cards swap in a king for
 * the winner, leaving a pawn beside the loser.
 *
 * Reuses the Taylor SVG piece set rather than redrawing so the colour
 * treatment matches every other board on the site exactly.
 */

type Props = {
  color: "w" | "b";
  /** Piece type. Defaults to `p` (pawn). Use `k` for a winner's king. */
  type?: "p" | "n" | "b" | "r" | "q" | "k";
  /** Pixel size. Defaults to 20. */
  size?: number;
  className?: string;
};

export function ColorPawn({ color, type = "p", size = 20, className }: Props) {
  const altMap: Record<string, string> = {
    p: color === "w" ? "plays white" : "plays black",
    k: color === "w" ? "white victorious" : "black victorious",
    q: "queen",
    r: "rook",
    b: "bishop",
    n: "knight",
  };
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG asset, cached by CDN
    <img
      src={`/pieces/taylor/${color}${type}.svg`}
      alt={altMap[type] ?? ""}
      width={size}
      height={size}
      draggable={false}
      className={className}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        userSelect: "none",
      }}
    />
  );
}
