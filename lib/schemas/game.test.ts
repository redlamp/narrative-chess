import { describe, expect, test } from "bun:test";
import {
  CreateGameInputSchema,
  JoinGameInputSchema,
  GameRowSchema,
  MoveEventSchema,
  GameStatusUpdateEventSchema,
  TerminationReasonSchema,
  ResignInputSchema,
  AbortInputSchema,
  RegisterObserverInputSchema,
  ObserverPresenceEventSchema,
} from "./game";

const UUID = "00000000-0000-0000-0000-000000000001";
// v4-shaped UUID for schemas that use strict .uuid() (version=4 in pos 13, variant=8 in pos 17)
const UUID_V4 = "00000000-0000-4000-8000-000000000001";
const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("CreateGameInputSchema", () => {
  test("accepts white", () => {
    const r = CreateGameInputSchema.safeParse({ myColor: "white" });
    expect(r.success).toBe(true);
  });
  test("accepts random", () => {
    const r = CreateGameInputSchema.safeParse({ myColor: "random" });
    expect(r.success).toBe(true);
  });
  test("rejects bogus color", () => {
    const r = CreateGameInputSchema.safeParse({ myColor: "purple" });
    expect(r.success).toBe(false);
  });
});

describe("JoinGameInputSchema", () => {
  test("accepts uuid", () => {
    expect(JoinGameInputSchema.safeParse({ gameId: UUID }).success).toBe(true);
  });
  test("rejects non-uuid", () => {
    expect(JoinGameInputSchema.safeParse({ gameId: "abc" }).success).toBe(false);
  });
});

describe("GameRowSchema", () => {
  test("accepts a fully populated row", () => {
    const r = GameRowSchema.safeParse({
      id: UUID,
      white_id: UUID,
      black_id: UUID,
      current_fen: FEN,
      ply: 0,
      status: "in_progress",
      current_turn: "w",
    });
    expect(r.success).toBe(true);
  });
  test("accepts open with one side null", () => {
    const r = GameRowSchema.safeParse({
      id: UUID,
      white_id: UUID,
      black_id: null,
      current_fen: FEN,
      ply: 0,
      status: "open",
      current_turn: "w",
    });
    expect(r.success).toBe(true);
  });
});

describe("MoveEventSchema", () => {
  test("accepts a postgres_changes payload-shape row", () => {
    const r = MoveEventSchema.safeParse({
      game_id: UUID,
      ply: 1,
      san: "e4",
      uci: "e2e4",
      fen_after: FEN,
      played_by: UUID,
      played_at: "2026-05-03T12:00:00Z",
    });
    expect(r.success).toBe(true);
  });
  test("rejects ply < 0", () => {
    const r = MoveEventSchema.safeParse({
      game_id: UUID,
      ply: -1,
      san: "e4",
      uci: "e2e4",
      fen_after: FEN,
      played_by: UUID,
      played_at: "2026-05-03T12:00:00Z",
    });
    expect(r.success).toBe(false);
  });
});

describe("GameStatusUpdateEventSchema", () => {
  test("accepts shape with new status", () => {
    const r = GameStatusUpdateEventSchema.safeParse({
      id: UUID,
      status: "in_progress",
      white_id: UUID,
      black_id: UUID,
    });
    expect(r.success).toBe(true);
  });
});

describe("TerminationReasonSchema", () => {
  test("accepts the seven valid reasons", () => {
    for (const r of [
      "checkmate", "stalemate", "threefold",
      "fifty_move", "insufficient", "resignation", "abort",
    ] as const) {
      expect(TerminationReasonSchema.safeParse(r).success).toBe(true);
    }
  });
  test("rejects unknown reasons", () => {
    expect(TerminationReasonSchema.safeParse("forfeit").success).toBe(false);
  });
});

describe("ResignInputSchema", () => {
  test("accepts a uuid", () => {
    expect(ResignInputSchema.safeParse({ gameId: UUID_V4 }).success).toBe(true);
  });
  test("rejects non-uuid", () => {
    expect(ResignInputSchema.safeParse({ gameId: "abc" }).success).toBe(false);
  });
});

describe("AbortInputSchema", () => {
  test("accepts a uuid", () => {
    expect(AbortInputSchema.safeParse({ gameId: UUID_V4 }).success).toBe(true);
  });
});

describe("GameStatusUpdateEventSchema (extended)", () => {
  test("accepts shape with termination_reason", () => {
    const r = GameStatusUpdateEventSchema.safeParse({
      id: UUID,
      status: "white_won",
      white_id: UUID,
      black_id: UUID,
      termination_reason: "resignation",
    });
    expect(r.success).toBe(true);
  });
  test("accepts shape without termination_reason", () => {
    const r = GameStatusUpdateEventSchema.safeParse({
      id: UUID,
      status: "in_progress",
      white_id: UUID,
      black_id: UUID,
    });
    expect(r.success).toBe(true);
  });
});

describe("RegisterObserverInputSchema", () => {
  test("accepts a v4-shaped uuid", () => {
    expect(
      RegisterObserverInputSchema.safeParse({ gameId: UUID_V4 }).success
    ).toBe(true);
  });
  test("rejects non-uuid", () => {
    expect(
      RegisterObserverInputSchema.safeParse({ gameId: "abc" }).success
    ).toBe(false);
  });
});

describe("ObserverPresenceEventSchema", () => {
  test("accepts a payload with joined_at timestamp", () => {
    expect(
      ObserverPresenceEventSchema.safeParse({
        joined_at: "2026-05-03T12:00:00Z",
      }).success
    ).toBe(true);
  });
  test("rejects missing joined_at", () => {
    expect(ObserverPresenceEventSchema.safeParse({}).success).toBe(false);
  });
});
