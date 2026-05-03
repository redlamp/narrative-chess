"use server";

import { applyMove } from "@/lib/chess/engine";
import {
  MakeMoveResultSchema,
  MoveInputSchema,
  type MakeMoveResult,
} from "@/lib/schemas/move";
import { createClient } from "@/lib/supabase/server";
import { JoinGameInputSchema, ResignInputSchema, AbortInputSchema, RegisterObserverInputSchema } from "@/lib/schemas/game";

type ErrorCode =
  | "validation"
  | "illegal_move"
  | "wrong_turn"
  | "game_over"
  | "concurrency_conflict"
  | "not_a_participant"
  | "not_active"
  | "game_not_found"
  | "unauthenticated"
  | "unknown";

export type MakeMoveOutcome =
  | { ok: true; data: MakeMoveResult }
  | { ok: false; code: ErrorCode; message: string };

export async function makeMove(input: unknown): Promise<MakeMoveOutcome> {
  const parsed = MoveInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues[0]?.message ?? "invalid input",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: "unauthenticated", message: "not signed in" };
  }

  const { data: game } = await supabase
    .from("games")
    .select("current_fen, current_turn, ply, status")
    .eq("id", parsed.data.gameId)
    .single();

  if (!game) {
    return {
      ok: false,
      code: "game_not_found",
      message: "game not found or not visible",
    };
  }

  let engineResult;
  try {
    engineResult = applyMove(game.current_fen, parsed.data.uci);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "engine failed";
    const code: ErrorCode = msg.includes("game_over")
      ? "game_over"
      : msg.includes("invalid_position")
        ? "validation"
        : "illegal_move";
    return { ok: false, code, message: msg };
  }

  const { data, error } = await supabase
    .rpc("make_move", {
      p_game_id: parsed.data.gameId,
      p_uci: engineResult.uci,
      p_san: engineResult.san,
      p_fen_after: engineResult.fenAfter,
      p_expected_ply: parsed.data.expectedPly,
      p_terminal_status: engineResult.terminalStatus ?? null,
    })
    .single();

  if (error) {
    return {
      ok: false,
      code: mapPgError(error.message),
      message: error.message,
    };
  }

  const rpcRow = data as {
    ply: number;
    current_fen: string;
    status: string;
  };

  const result = MakeMoveResultSchema.parse({
    game_id: parsed.data.gameId,
    ply: rpcRow.ply,
    san: engineResult.san,
    uci: engineResult.uci,
    fen_after: rpcRow.current_fen,
    status: rpcRow.status,
  });

  return { ok: true, data: result };
}

function mapPgError(msg: string): ErrorCode {
  if (msg.includes("concurrency_conflict")) return "concurrency_conflict";
  if (msg.includes("not_a_participant")) return "not_a_participant";
  if (msg.includes("wrong_turn")) return "wrong_turn";
  if (msg.includes("not_active")) return "not_active";
  if (msg.includes("game_not_found")) return "game_not_found";
  if (msg.includes("unauthenticated")) return "unauthenticated";
  return "unknown";
}

export type JoinGameErrorCode =
  | "validation"
  | "unauthenticated"
  | "game_not_found"
  | "not_open"
  | "already_a_participant"
  | "already_filled"
  | "unknown";

export type JoinGameOutcome =
  | { ok: true }
  | { ok: false; code: JoinGameErrorCode; message: string };

function mapJoinPgError(msg: string): JoinGameErrorCode {
  if (msg.includes("already_filled")) return "already_filled";
  if (msg.includes("already_a_participant")) return "already_a_participant";
  if (msg.includes("not_open")) return "not_open";
  if (msg.includes("game_not_found")) return "game_not_found";
  if (msg.includes("unauthenticated")) return "unauthenticated";
  return "unknown";
}

export async function joinGame(input: unknown): Promise<JoinGameOutcome> {
  const parsed = JoinGameInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues[0]?.message ?? "invalid input",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: "unauthenticated", message: "not signed in" };
  }

  const { error } = await supabase.rpc("join_open_game", { p_game_id: parsed.data.gameId });
  if (error) {
    return { ok: false, code: mapJoinPgError(error.message), message: error.message };
  }

  return { ok: true };
}

export type ResignErrorCode =
  | "validation"
  | "unauthenticated"
  | "game_not_found"
  | "not_active"
  | "not_a_participant"
  | "unknown";

export type ResignOutcome =
  | { ok: true }
  | { ok: false; code: ResignErrorCode; message: string };

function mapResignPgError(msg: string): ResignErrorCode {
  if (msg.includes("not_a_participant")) return "not_a_participant";
  if (msg.includes("not_active")) return "not_active";
  if (msg.includes("game_not_found")) return "game_not_found";
  if (msg.includes("unauthenticated")) return "unauthenticated";
  return "unknown";
}

export async function resign(input: unknown): Promise<ResignOutcome> {
  const parsed = ResignInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues[0]?.message ?? "invalid input",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: "unauthenticated", message: "not signed in" };
  }

  const { error } = await supabase.rpc("resign", { p_game_id: parsed.data.gameId });
  if (error) {
    return { ok: false, code: mapResignPgError(error.message), message: error.message };
  }

  return { ok: true };
}

export type AbortErrorCode =
  | "validation"
  | "unauthenticated"
  | "game_not_found"
  | "not_a_participant"
  | "not_abortable"
  | "unknown";

export type AbortOutcome =
  | { ok: true }
  | { ok: false; code: AbortErrorCode; message: string };

function mapAbortPgError(msg: string): AbortErrorCode {
  if (msg.includes("not_abortable")) return "not_abortable";
  if (msg.includes("not_a_participant")) return "not_a_participant";
  if (msg.includes("game_not_found")) return "game_not_found";
  if (msg.includes("unauthenticated")) return "unauthenticated";
  return "unknown";
}

export async function abortGame(input: unknown): Promise<AbortOutcome> {
  const parsed = AbortInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues[0]?.message ?? "invalid input",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: "unauthenticated", message: "not signed in" };
  }

  const { error } = await supabase.rpc("abort_game", { p_game_id: parsed.data.gameId });
  if (error) {
    return { ok: false, code: mapAbortPgError(error.message), message: error.message };
  }

  return { ok: true };
}

export type RegisterObserverErrorCode =
  | "validation"
  | "unauthenticated"
  | "unknown";

export type RegisterObserverOutcome =
  | { ok: true; count: number }
  | { ok: false; code: RegisterObserverErrorCode; message: string };

export async function registerObserver(
  input: unknown,
): Promise<RegisterObserverOutcome> {
  const parsed = RegisterObserverInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues[0]?.message ?? "invalid input",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: "unauthenticated", message: "not signed in" };
  }

  const { data, error } = await supabase.rpc("register_observer", {
    p_game_id: parsed.data.gameId,
  });
  if (error) {
    return { ok: false, code: "unknown", message: error.message };
  }
  const count = typeof data === "number" ? data : 0;
  return { ok: true, count };
}
