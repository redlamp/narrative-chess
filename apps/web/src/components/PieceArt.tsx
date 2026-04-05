import type { PieceKind, PieceSide } from "@narrative-chess/content-schema";
import { getPieceAssetPath, getPieceGlyph, getPieceKindLabel } from "../chessPresentation";

type PieceArtProps = {
  side: PieceSide;
  kind: PieceKind;
  className?: string;
  decorative?: boolean;
};

export function PieceArt({
  side,
  kind,
  className,
  decorative = true
}: PieceArtProps) {
  const label = `${side === "white" ? "White" : "Black"} ${getPieceKindLabel(kind)}`;

  return (
    <img
      src={getPieceAssetPath({ side, kind })}
      alt={decorative ? "" : label}
      aria-hidden={decorative ? "true" : undefined}
      className={className}
      draggable={false}
      onError={(event) => {
        const target = event.currentTarget;
        target.onerror = null;
        target.replaceWith(
          Object.assign(document.createElement("span"), {
            className,
            textContent: getPieceGlyph({ side, kind }),
            ariaHidden: decorative ? "true" : null
          })
        );
      }}
    />
  );
}
