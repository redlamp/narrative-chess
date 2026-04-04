import type { MouseEvent } from "react";
import { getPieceAtSquare } from "@narrative-chess/game-core";
import type { GameSnapshot, PieceState, Square } from "@narrative-chess/content-schema";

const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

const glyphs: Record<PieceState["side"], Record<PieceState["kind"], string>> = {
  white: {
    pawn: "♙",
    rook: "♖",
    knight: "♘",
    bishop: "♗",
    queen: "♕",
    king: "♔"
  },
  black: {
    pawn: "♟",
    rook: "♜",
    knight: "♞",
    bishop: "♝",
    queen: "♛",
    king: "♚"
  }
};

type BoardCell = {
  square: Square;
  occupant: PieceState | null;
  isLight: boolean;
};

type BoardProps = {
  snapshot: GameSnapshot;
  cells: BoardCell[];
  selectedSquare: Square | null;
  legalMoves: Square[];
  onSquareClick: (square: Square) => void;
};

function squareName(file: (typeof files)[number], rank: (typeof ranks)[number]) {
  return `${file}${rank}` as Square;
}

function getGlyph(piece: PieceState | null) {
  if (!piece) {
    return "";
  }

  return glyphs[piece.side][piece.kind];
}

export function Board({
  snapshot,
  cells,
  selectedSquare,
  legalMoves,
  onSquareClick
}: BoardProps) {
  const cellMap = new Map(cells.map((cell) => [cell.square, cell]));

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const square = event.currentTarget.dataset.square as Square | undefined;
    if (square) {
      onSquareClick(square);
    }
  };

  return (
    <div className="board-shell">
      <div className="board-grid" role="grid" aria-label="Chess board">
        {ranks.map((rank) =>
          files.map((file) => {
            const square = squareName(file, rank);
            const cell = cellMap.get(square);
            const piece = cell?.occupant ?? getPieceAtSquare(snapshot, square);
            const isSelected = selectedSquare === square;
            const isLegalTarget = legalMoves.includes(square);

            return (
              <button
                key={square}
                type="button"
                className={[
                  "board-square",
                  cell?.isLight ? "board-square--light" : "board-square--dark",
                  isSelected ? "board-square--selected" : "",
                  isLegalTarget ? "board-square--target" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-square={square}
                aria-pressed={isSelected}
                aria-label={`${square}${piece ? `, ${piece.side} ${piece.kind}` : ""}`}
                onClick={handleClick}
              >
                <span className="board-square__coordinate board-square__coordinate--top">
                  {file === "a" ? rank : ""}
                </span>
                <span className="board-square__coordinate board-square__coordinate--bottom">
                  {rank === "1" ? file : ""}
                </span>
                <span className={`board-square__piece ${piece ? `is-${piece.side}` : "is-empty"}`}>
                  {getGlyph(piece)}
                </span>
                {isLegalTarget ? <span className="board-square__target-dot" /> : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
