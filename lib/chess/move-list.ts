import type { MoveEvent } from "@/lib/schemas/game";

const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type MoveLike = Pick<MoveEvent, "ply" | "san" | "fen_after" | "played_at">;

/**
 * Time elapsed for the move at index `i` of `moves` (already sorted by ply).
 * Anchor for ply 1 is `gameStartedAt` (the timestamp when both players joined
 * and `turn_started_at` was first set); if unknown, returns null for ply 1
 * so the cell renders without a duration.
 *
 * Returns milliseconds, or null when the prior anchor isn't available.
 */
export function moveDurationMs(
  moves: MoveLike[],
  i: number,
  gameStartedAt: string | null,
): number | null {
  if (i < 0 || i >= moves.length) return null;
  const cur = new Date(moves[i].played_at).getTime();
  if (Number.isNaN(cur)) return null;
  let prev: number;
  if (i === 0) {
    if (!gameStartedAt) return null;
    prev = new Date(gameStartedAt).getTime();
    if (Number.isNaN(prev)) return null;
  } else {
    prev = new Date(moves[i - 1].played_at).getTime();
    if (Number.isNaN(prev)) return null;
  }
  return Math.max(0, cur - prev);
}

/**
 * Compact human-readable duration for the move-list cell.
 * <60s -> "5s" / "59s"
 * <1h  -> "2m" / "59m"
 * <1d  -> "3h" / "23h"
 * else -> "2d" / "9d"
 */
export function formatMoveDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

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
