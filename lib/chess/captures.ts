import type { Piece } from "@/lib/chess/board-types";

/**
 * Per-side starting piece counts. Used to derive captures by comparing the
 * current FEN's board section against these baselines.
 */
const START_COUNTS = { p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 } as const;

type PieceLetter = keyof typeof START_COUNTS;

/**
 * Order captured pieces by descending material value for display so the
 * highest-value captures sit leftmost in the strip.
 */
const DISPLAY_ORDER: PieceLetter[] = ["q", "r", "b", "n", "p"];

export type Captures = {
  /** Black pieces captured by white. Ordered by display value. */
  byWhite: Piece[];
  /** White pieces captured by black. Ordered by display value. */
  byBlack: Piece[];
};

/**
 * Parse the board portion of a FEN string and return the captured pieces
 * for each side. White's captured list contains BLACK pieces (lowercase
 * letters in FEN) and vice versa.
 *
 * Pawns that promoted are still treated as captured (FEN no longer shows
 * them on the board). The promoted piece increases the side's count of
 * its new type but doesn't add a fake capture.
 */
export function capturedFromFen(fen: string): Captures {
  const board = fen.split(" ")[0] ?? "";
  const counts: Record<"w" | "b", Record<PieceLetter, number>> = {
    w: { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 },
    b: { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 },
  };
  for (const ch of board) {
    if (ch === "/" || /\d/.test(ch)) continue;
    const lower = ch.toLowerCase() as PieceLetter;
    if (!(lower in START_COUNTS)) continue;
    const side: "w" | "b" = ch === lower ? "b" : "w";
    counts[side][lower] += 1;
  }

  const byWhite: Piece[] = [];
  const byBlack: Piece[] = [];
  for (const letter of DISPLAY_ORDER) {
    const start = START_COUNTS[letter];
    // Each side may have promoted pawns into this type, which inflates
    // the count above start. Clamp the deficit at 0 so promotions don't
    // surface as negative captures.
    const blackOnBoard = counts.b[letter];
    const whiteOnBoard = counts.w[letter];
    const blackDeficit = Math.max(0, start - blackOnBoard);
    const whiteDeficit = Math.max(0, start - whiteOnBoard);

    // Black-piece losses go onto white's strip (white captured them) and
    // vice versa. PieceLetter -> Piece: uppercase prefix for the piece
    // SHOWN, color suffix indicates the piece's ORIGINAL side.
    const upper = letter.toUpperCase();
    for (let i = 0; i < blackDeficit; i++) {
      byWhite.push(`b${upper}` as Piece);
    }
    for (let i = 0; i < whiteDeficit; i++) {
      byBlack.push(`w${upper}` as Piece);
    }
  }

  return { byWhite, byBlack };
}
