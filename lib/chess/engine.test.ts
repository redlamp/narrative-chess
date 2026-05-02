import { describe, expect, test } from "bun:test";
import { applyMove, validateMove } from "./engine";

const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("validateMove", () => {
  test("legal opening: e2e4", () => {
    const r = validateMove(STARTING_FEN, "e2e4");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.san).toBe("e4");
      expect(r.uci).toBe("e2e4");
      expect(r.fenAfter).toContain("4P3");
      expect(r.terminalStatus).toBeNull();
    }
  });

  test("illegal move from starting position: e2e5", () => {
    const r = validateMove(STARTING_FEN, "e2e5");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("illegal_move");
    }
  });

  test("invalid FEN", () => {
    const r = validateMove("not a fen", "e2e4");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("invalid_position");
    }
  });

  test("checkmate detection — Fool's Mate", () => {
    // After 1.f3 e5 2.g4, black plays Qh4# to mate.
    const beforeMate =
      "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2";
    const r = validateMove(beforeMate, "d8h4");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.terminalStatus).toBe("black_won");
    }
  });

  test("stalemate detection — King and Queen vs lone King", () => {
    // Classic stalemate setup: black K on a8, white K on c7, white Q on b6.
    // Black to move and stalemated (no legal moves, not in check).
    const stalemated = "k7/2K5/1Q6/8/8/8/8/8 b - - 0 1";
    // Position itself IS stalemate. Use a position one ply before to test the move that creates it.
    // White plays Qb6 from Qa6 to deliver stalemate. Setup that:
    const beforeStalemate = "k7/2K5/Q7/8/8/8/8/8 w - - 0 1"; // Qa6 → b6
    const r = validateMove(beforeStalemate, "a6b6");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.terminalStatus).toBe("draw");
    }
    // sanity-check the post-move FEN matches the stalemate position
    if (r.ok) {
      expect(r.fenAfter.startsWith("k7/2K5/1Q6")).toBe(true);
    }
    // unused var to silence linter on the helper FEN
    void stalemated;
  });

  test("game over rejection on already-over position", () => {
    // Stalemate position: black to move, no legal moves, not in check.
    const stalemate = "k7/2K5/1Q6/8/8/8/8/8 b - - 0 1";
    const r = validateMove(stalemate, "a8a7");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code === "game_over" || r.code === "illegal_move").toBe(true);
    }
  });

  test("promotion to queen: e7e8q", () => {
    // Black K on a8 (out of pawn's path), white pawn on e7, white K on h1.
    const fen = "k7/4P3/8/8/8/8/8/7K w - - 0 1";
    const r = validateMove(fen, "e7e8q");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.san).toContain("Q");
    }
  });

  test("en passant", () => {
    // Black pawn on d4, white plays e2e4 setting en-passant target on e3.
    const fen = "rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 2";
    const r = validateMove(fen, "d4e3");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.san).toBe("dxe3");
    }
  });

  test("castling kingside: O-O", () => {
    // White can castle kingside: K on e1, R on h1, squares clear.
    const fen = "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPBPPP/RNBQK2R w KQkq - 0 1";
    const r = validateMove(fen, "e1g1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.san).toBe("O-O");
    }
  });
});

describe("applyMove", () => {
  test("throws on illegal move", () => {
    expect(() => applyMove(STARTING_FEN, "e2e5")).toThrow();
  });

  test("returns result on legal move", () => {
    const r = applyMove(STARTING_FEN, "e2e4");
    expect(r.san).toBe("e4");
  });
});
