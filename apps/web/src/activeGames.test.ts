import { describe, expect, it } from "vitest";
import { getSupabaseMovePromotion, resolveTimeoutDeadlineMs } from "./activeGames";

describe("activeGames append move helpers", () => {
  it("maps chess promotion pieces to Supabase move notation", () => {
    expect(getSupabaseMovePromotion("queen")).toBe("q");
    expect(getSupabaseMovePromotion("rook")).toBe("r");
    expect(getSupabaseMovePromotion("bishop")).toBe("b");
    expect(getSupabaseMovePromotion("knight")).toBe("n");
  });

  it("omits non-promotion pieces from Supabase move payloads", () => {
    expect(getSupabaseMovePromotion(null)).toBeNull();
    expect(getSupabaseMovePromotion("pawn")).toBeNull();
    expect(getSupabaseMovePromotion("king")).toBeNull();
  });
});

describe("resolveTimeoutDeadlineMs", () => {
  const baseGame = {
    status: "active" as const,
    currentTurn: "black" as const,
    yourSide: "white" as const,
    yourParticipantStatus: "active" as const,
    deadlineAt: "2026-04-20T12:00:00.000Z"
  };

  it("returns the deadline timestamp when the caller can claim", () => {
    expect(resolveTimeoutDeadlineMs(baseGame)).toBe(Date.parse(baseGame.deadlineAt));
  });

  it("ignores deadlines on the caller's own turn", () => {
    expect(
      resolveTimeoutDeadlineMs({ ...baseGame, currentTurn: "white" })
    ).toBeNull();
  });

  it("ignores deadlines when not active", () => {
    expect(
      resolveTimeoutDeadlineMs({ ...baseGame, status: "completed" })
    ).toBeNull();
  });

  it("ignores deadlines when viewer is a spectator", () => {
    expect(
      resolveTimeoutDeadlineMs({ ...baseGame, yourSide: "spectator" })
    ).toBeNull();
  });

  it("ignores invalid deadline strings", () => {
    expect(
      resolveTimeoutDeadlineMs({ ...baseGame, deadlineAt: "not a date" })
    ).toBeNull();
  });

  it("ignores missing deadlines", () => {
    expect(
      resolveTimeoutDeadlineMs({ ...baseGame, deadlineAt: null })
    ).toBeNull();
  });
});
