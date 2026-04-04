import type { Square } from "@narrative-chess/content-schema";

export const boardFiles = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const boardRanks = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

type BoardNavigationKey =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "Home"
  | "End";

export function squareName(
  file: (typeof boardFiles)[number],
  rank: (typeof boardRanks)[number]
) {
  return `${file}${rank}` as Square;
}

function getBoardSquareIndex(square: Square) {
  return {
    fileIndex: boardFiles.indexOf(square[0] as (typeof boardFiles)[number]),
    rankIndex: boardRanks.indexOf(square[1] as (typeof boardRanks)[number])
  };
}

export function getNextBoardFocusSquare(square: Square, key: BoardNavigationKey) {
  const { fileIndex, rankIndex } = getBoardSquareIndex(square);
  if (fileIndex < 0 || rankIndex < 0) {
    return square;
  }

  switch (key) {
    case "ArrowUp":
      return squareName(boardFiles[fileIndex]!, boardRanks[Math.max(0, rankIndex - 1)]!);
    case "ArrowDown":
      return squareName(
        boardFiles[fileIndex]!,
        boardRanks[Math.min(boardRanks.length - 1, rankIndex + 1)]!
      );
    case "ArrowLeft":
      return squareName(boardFiles[Math.max(0, fileIndex - 1)]!, boardRanks[rankIndex]!);
    case "ArrowRight":
      return squareName(
        boardFiles[Math.min(boardFiles.length - 1, fileIndex + 1)]!,
        boardRanks[rankIndex]!
      );
    case "Home":
      return squareName(boardFiles[0], boardRanks[rankIndex]!);
    case "End":
      return squareName(boardFiles[boardFiles.length - 1], boardRanks[rankIndex]!);
    default:
      return square;
  }
}
