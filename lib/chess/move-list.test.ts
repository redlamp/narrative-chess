import { describe, expect, it } from "bun:test";
import {
  formatMoveDuration,
  moveDurationMs,
  pairsFromMoves,
  stepPly,
  viewedFen,
} from "./move-list";

const MOVES = [
  { ply: 1, san: "e4", fen_after: "FEN1", played_at: "2026-05-15T12:00:00Z" },
  { ply: 2, san: "c5", fen_after: "FEN2", played_at: "2026-05-15T12:00:05Z" },
  { ply: 3, san: "Nf3", fen_after: "FEN3", played_at: "2026-05-15T12:02:05Z" },
];

describe("pairsFromMoves", () => {
  it("returns empty array when moves is empty", () => {
    expect(pairsFromMoves([])).toEqual([]);
  });

  it("pairs white + black per move number", () => {
    expect(pairsFromMoves(MOVES.slice(0, 2))).toEqual([
      { moveNum: 1, white: MOVES[0], black: MOVES[1] },
    ]);
  });

  it("trailing white move has null black", () => {
    expect(pairsFromMoves(MOVES)).toEqual([
      { moveNum: 1, white: MOVES[0], black: MOVES[1] },
      { moveNum: 2, white: MOVES[2], black: null },
    ]);
  });
});

describe("viewedFen", () => {
  const liveFen = "LIVE_FEN";

  it("returns liveFen when viewedPly is null", () => {
    expect(viewedFen(MOVES, null, liveFen)).toBe(liveFen);
  });

  it("returns liveFen when viewedPly equals last move ply", () => {
    expect(viewedFen(MOVES, 3, liveFen)).toBe(liveFen);
  });

  it("returns fen_after of the matching move", () => {
    expect(viewedFen(MOVES, 1, liveFen)).toBe("FEN1");
    expect(viewedFen(MOVES, 2, liveFen)).toBe("FEN2");
  });

  it("returns the chess starting FEN when viewedPly is 0", () => {
    expect(viewedFen(MOVES, 0, liveFen)).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
  });

  it("falls back to liveFen when viewedPly has no matching move", () => {
    expect(viewedFen(MOVES, 99, liveFen)).toBe(liveFen);
  });
});

describe("stepPly", () => {
  it("steps forward within range", () => {
    expect(stepPly(2, +1, 5)).toBe(3);
  });

  it("steps back within range", () => {
    expect(stepPly(2, -1, 5)).toBe(1);
  });

  it("clamps at 0 going back", () => {
    expect(stepPly(0, -1, 5)).toBe(0);
  });

  it("clamps at livePly going forward", () => {
    expect(stepPly(5, +1, 5)).toBe(5);
  });

  it("treats null current as livePly anchor", () => {
    expect(stepPly(null, -1, 5)).toBe(4);
    expect(stepPly(null, +1, 5)).toBe(5);
  });
});

describe("moveDurationMs", () => {
  it("returns null for ply 1 when gameStartedAt is null", () => {
    expect(moveDurationMs(MOVES, 0, null)).toBeNull();
  });

  it("computes ply 1 delta from gameStartedAt", () => {
    expect(moveDurationMs(MOVES, 0, "2026-05-15T11:59:55Z")).toBe(5_000);
  });

  it("computes subsequent plies from played_at deltas", () => {
    expect(moveDurationMs(MOVES, 1, null)).toBe(5_000);
    expect(moveDurationMs(MOVES, 2, null)).toBe(120_000);
  });

  it("returns null for out-of-range indices", () => {
    expect(moveDurationMs(MOVES, -1, null)).toBeNull();
    expect(moveDurationMs(MOVES, 99, null)).toBeNull();
  });
});

describe("formatMoveDuration", () => {
  it("renders seconds under a minute", () => {
    expect(formatMoveDuration(5_000)).toBe("5s");
    expect(formatMoveDuration(59_000)).toBe("59s");
  });

  it("renders minutes under an hour", () => {
    expect(formatMoveDuration(120_000)).toBe("2m");
    expect(formatMoveDuration(59 * 60_000)).toBe("59m");
  });

  it("renders hours under a day", () => {
    expect(formatMoveDuration(2 * 3_600_000)).toBe("2h");
  });

  it("renders days at and above a day", () => {
    expect(formatMoveDuration(2 * 86_400_000)).toBe("2d");
  });
});
