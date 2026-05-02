import { Chess, type Move } from "chess.js";

export type TerminalStatus = "white_won" | "black_won" | "draw" | null;

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
