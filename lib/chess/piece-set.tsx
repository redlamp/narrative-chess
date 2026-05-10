import type { CustomPieces, Piece } from "@/lib/chess/board-types";

/**
 * Default piece set — Taylor's hand-drawn pieces sourced from the design
 * system Figma file (page 22:2, set "Taylor"). Stored as flat SVG files in
 * `public/pieces/taylor/` and rendered via `react-chessboard`'s
 * `customPieces` prop.
 *
 * Each renderer returns an `<img>` sized to `squareWidth`. SVGs already carry
 * their own colour palette (light grey-to-warm-grey gradient for white,
 * warm-dark for black), so no theme-aware overrides are applied here.
 */

type FilePieceMap = Record<Piece, string>;

const TAYLOR_FILES: FilePieceMap = {
  wP: "wp",
  wN: "wn",
  wB: "wb",
  wR: "wr",
  wQ: "wq",
  wK: "wk",
  bP: "bp",
  bN: "bn",
  bB: "bb",
  bR: "br",
  bQ: "bq",
  bK: "bk",
};

const ENTRIES = Object.entries(TAYLOR_FILES) as Array<[Piece, string]>;

export const taylorPieces: CustomPieces = Object.fromEntries(
  ENTRIES.map(([piece, file]) => [
    piece,
    ({ squareWidth }: { squareWidth: number }) => (
      // eslint-disable-next-line @next/next/no-img-element -- SVG pieces re-render every drag tick; next/image's remote-SVG path is disabled by default and adds overhead with no win for cached static assets.
      <img
        src={`/pieces/taylor/${file}.svg`}
        alt={piece}
        width={squareWidth}
        height={squareWidth}
        draggable={false}
        style={{ pointerEvents: "none", userSelect: "none" }}
      />
    ),
  ]),
) as CustomPieces;
