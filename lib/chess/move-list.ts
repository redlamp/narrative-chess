import type { MoveEvent } from "@/lib/schemas/game";

const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type MoveLike = Pick<MoveEvent, "ply" | "san" | "fen_after">;

export type Pair = {
  moveNum: number;
  white: MoveLike;
  black: MoveLike | null;
};

/**
 * Group sequential moves into white/black pairs by full-move number.
 * `moveNum` is 1-indexed (chess convention). Trailing white move with no
 * black response yields a pair with black=null.
 */
export function pairsFromMoves(moves: MoveLike[]): Pair[] {
  const sorted = [...moves].sort((a, b) => a.ply - b.ply);
  const pairs: Pair[] = [];
  for (let i = 0; i < sorted.length; i += 2) {
    pairs.push({
      moveNum: Math.floor(i / 2) + 1,
      white: sorted[i],
      black: sorted[i + 1] ?? null,
    });
  }
  return pairs;
}

/**
 * Resolve the FEN to display on the board given the user's scrub position.
 * - viewedPly === null         -> liveFen (follow live)
 * - viewedPly === 0            -> standard chess starting position
 * - viewedPly === last move    -> liveFen (no need to look up)
 * - otherwise                  -> fen_after of matching move, fall back to liveFen
 */
export function viewedFen(
  moves: MoveLike[],
  viewedPly: number | null,
  liveFen: string,
): string {
  if (viewedPly === null) return liveFen;
  if (viewedPly === 0) return STARTING_FEN;
  const lastPly = moves.length > 0 ? moves[moves.length - 1].ply : 0;
  if (viewedPly === lastPly) return liveFen;
  const m = moves.find((mv) => mv.ply === viewedPly);
  return m?.fen_after ?? liveFen;
}

/**
 * Step the viewed ply by delta (typically -1 / +1), clamped to [0, livePly].
 * Treats `null` as "currently at livePly" so left-arrow from live snaps to
 * livePly - 1.
 */
export function stepPly(
  current: number | null,
  delta: number,
  livePly: number,
): number {
  const anchor = current ?? livePly;
  const next = anchor + delta;
  return Math.max(0, Math.min(livePly, next));
}
