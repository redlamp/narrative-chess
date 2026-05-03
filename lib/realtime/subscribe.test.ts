import { describe, expect, test } from "bun:test";
import {
  parseMoveEvent,
  parseGameStatusUpdate,
} from "./subscribe";

const UUID = "00000000-0000-0000-0000-000000000001";
const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("parseMoveEvent", () => {
  test("accepts a valid postgres_changes new payload", () => {
    const m = parseMoveEvent({
      game_id: UUID,
      ply: 1,
      san: "e4",
      uci: "e2e4",
      fen_after: FEN,
      played_by: UUID,
      played_at: "2026-05-03T12:00:00Z",
    });
    expect(m).not.toBeNull();
    expect(m!.ply).toBe(1);
  });
  test("returns null on garbage", () => {
    expect(parseMoveEvent({ ply: "not-a-number" })).toBeNull();
    expect(parseMoveEvent(null)).toBeNull();
  });
});

describe("parseGameStatusUpdate", () => {
  test("accepts a valid update", () => {
    const u = parseGameStatusUpdate({
      id: UUID,
      status: "in_progress",
      white_id: UUID,
      black_id: UUID,
    });
    expect(u).not.toBeNull();
    expect(u!.status).toBe("in_progress");
  });
  test("returns null on missing fields", () => {
    expect(parseGameStatusUpdate({ id: UUID })).toBeNull();
  });
});
