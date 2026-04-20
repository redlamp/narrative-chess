import { describe, expect, it } from "vitest";
import {
  formatTimeControlLabel,
  getSupabaseMovePromotion,
  getTimeControlPresetById,
  resolveTimeoutDeadlineMs,
  timeControlPresets
} from "./activeGames";

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

  it("ignores deadlines when viewer's participant row is not active", () => {
    expect(
      resolveTimeoutDeadlineMs({ ...baseGame, yourParticipantStatus: "left" })
    ).toBeNull();
  });
});

describe("getTimeControlPresetById", () => {
  it("returns the preset for a known id", () => {
    expect(getTimeControlPresetById("live-10-0")?.label).toBe("10 min");
    expect(getTimeControlPresetById("deadline-daily")?.label).toBe("1 move / day");
  });

  it("returns null for unknown ids", () => {
    expect(getTimeControlPresetById("not-a-preset")).toBeNull();
    expect(getTimeControlPresetById("")).toBeNull();
  });

  it("exposes the canonical preset list", () => {
    expect(timeControlPresets.length).toBeGreaterThan(0);
    const ids = timeControlPresets.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("formatTimeControlLabel", () => {
  it("prefers the canonical preset label when the input matches a preset", () => {
    expect(
      formatTimeControlLabel({
        timeControlKind: "live_clock",
        baseSeconds: 900,
        incrementSeconds: 10,
        moveDeadlineSeconds: null
      })
    ).toBe("15 + 10");
  });

  it("matches the correspondence daily preset", () => {
    expect(
      formatTimeControlLabel({
        timeControlKind: "move_deadline",
        baseSeconds: null,
        incrementSeconds: 0,
        moveDeadlineSeconds: 86400
      })
    ).toBe("1 move / day");
  });

  it("formats custom live clock without increment", () => {
    expect(
      formatTimeControlLabel({
        timeControlKind: "live_clock",
        baseSeconds: 300,
        incrementSeconds: 0,
        moveDeadlineSeconds: null
      })
    ).toBe("5 min");
  });

  it("formats custom live clock with increment", () => {
    expect(
      formatTimeControlLabel({
        timeControlKind: "live_clock",
        baseSeconds: 180,
        incrementSeconds: 2,
        moveDeadlineSeconds: null
      })
    ).toBe("3 + 2");
  });

  it("formats correspondence windows in the largest natural unit", () => {
    expect(
      formatTimeControlLabel({
        timeControlKind: "move_deadline",
        baseSeconds: null,
        incrementSeconds: 0,
        moveDeadlineSeconds: 604800 * 2
      })
    ).toBe("2 move / week");

    expect(
      formatTimeControlLabel({
        timeControlKind: "move_deadline",
        baseSeconds: null,
        incrementSeconds: 0,
        moveDeadlineSeconds: 3600 * 4
      })
    ).toBe("4 move / hour");
  });

  it("falls back to a generic label when nothing matches", () => {
    expect(
      formatTimeControlLabel({
        timeControlKind: "live_clock",
        baseSeconds: null,
        incrementSeconds: 0,
        moveDeadlineSeconds: null
      })
    ).toBe("Live clock");

    expect(
      formatTimeControlLabel({
        timeControlKind: "move_deadline",
        baseSeconds: null,
        incrementSeconds: 0,
        moveDeadlineSeconds: null
      })
    ).toBe("Move deadline");
  });
});
