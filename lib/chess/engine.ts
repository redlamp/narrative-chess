import { Chess, type Move, type Square } from "chess.js";

export type TerminalStatus = "white_won" | "black_won" | "draw" | null;
export type Color = "w" | "b";

export type CheckState = {
  /** The side currently in check (i.e. side-to-move). */
  side: Color;
  /** True if it's checkmate; false if regular check. */
  mate: boolean;
};

export type MoveResult = {
  ok: true;
  san: string;
  uci: string;
  fenAfter: string;
  terminalStatus: TerminalStatus;
};

export type MoveError = {
  ok: false;
  code: "illegal_move" | "wrong_turn" | "game_over" | "invalid_position";
  message: string;
};

export function validateMove(
  fenBefore: string,
  uci: string,
): MoveResult | MoveError {
  let chess: Chess;
  try {
    chess = new Chess(fenBefore);
  } catch {
    return {
      ok: false,
      code: "invalid_position",
      message: "FEN is not a legal chess position",
    };
  }

  if (chess.isGameOver()) {
    return {
      ok: false,
      code: "game_over",
      message: "Game is already over",
    };
  }

  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length === 5 ? uci[4] : undefined;

  let move: Move;
  try {
    move = chess.move({ from, to, promotion }) as Move;
  } catch {
    return {
      ok: false,
      code: "illegal_move",
      message: `${uci} is not a legal move from ${fenBefore}`,
    };
  }

  return {
    ok: true,
    san: move.san,
    uci: move.lan,
    fenAfter: chess.fen(),
    terminalStatus: terminalStatus(chess),
  };
}

export function applyMove(fenBefore: string, uci: string): MoveResult {
  const result = validateMove(fenBefore, uci);
  if (!result.ok) {
    throw new Error(`engine: ${result.code} — ${result.message}`);
  }
  return result;
}

function terminalStatus(chess: Chess): TerminalStatus {
  if (chess.isCheckmate()) {
    return chess.turn() === "w" ? "black_won" : "white_won";
  }
  if (
    chess.isStalemate() ||
    chess.isInsufficientMaterial() ||
    chess.isThreefoldRepetition() ||
    chess.isDraw()
  ) {
    return "draw";
  }
  return null;
}

/**
 * Squares the piece on `from` can legally move to in the given fen.
 * Returns an empty array on invalid fen, empty source, or no legal moves.
 */
export function legalMovesFrom(fen: string, from: string): string[] {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return [];
  }
  let moves: Move[];
  try {
    moves = chess.moves({ square: from as Square, verbose: true }) as Move[];
  } catch {
    return [];
  }
  return moves.map((m) => m.to);
}

/**
 * Returns the side currently in check + whether it's mate, or null.
 * "side" is always the side-to-move per chess.js semantics.
 */
export function checkState(fen: string): CheckState | null {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }
  if (!chess.inCheck()) return null;
  return { side: chess.turn(), mate: chess.isCheckmate() };
}

/**
 * Returns the algebraic square ("e1", "g8", ...) of the king of the
 * given side, or null if the fen is invalid or the king is missing
 * (the latter is impossible in a legal position).
 */
export function kingSquare(fen: string, side: Color): string | null {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }
  for (const row of chess.board()) {
    for (const sq of row) {
      if (sq && sq.type === "k" && sq.color === side) return sq.square;
    }
  }
  return null;
}
