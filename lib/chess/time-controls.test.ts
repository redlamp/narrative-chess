import { describe, expect, test } from "bun:test";
import {
  TIME_CONTROL_PRESETS,
  presetById,
  formatTimeControlLabel,
  type PresetId,
} from "./time-controls";

describe("TIME_CONTROL_PRESETS", () => {
  test("has 5 presets in stable order", () => {
    const ids = TIME_CONTROL_PRESETS.map((p) => p.id);
    expect(ids).toEqual(["untimed", "5min", "10min", "15+10", "1day"]);
  });
  test("untimed has no time fields", () => {
    const p = presetById("untimed");
    expect(p.timeControlType).toBeNull();
    expect(p.timeInitialSeconds).toBeUndefined();
    expect(p.timePerMoveSeconds).toBeUndefined();
  });
  test("5min is live, initial 300, no increment", () => {
    const p = presetById("5min");
    expect(p.timeControlType).toBe("live");
    expect(p.timeInitialSeconds).toBe(300);
    expect(p.timeIncrementSeconds).toBe(0);
  });
  test("10min is live, initial 600", () => {
    const p = presetById("10min");
    expect(p.timeInitialSeconds).toBe(600);
  });
  test("15+10 is live, initial 900, increment 10", () => {
    const p = presetById("15+10");
    expect(p.timeInitialSeconds).toBe(900);
    expect(p.timeIncrementSeconds).toBe(10);
  });
  test("1day is correspondence, 86400 per move", () => {
    const p = presetById("1day");
    expect(p.timeControlType).toBe("correspondence");
    expect(p.timePerMoveSeconds).toBe(86400);
  });
  test("presetById throws on unknown id", () => {
    expect(() => presetById("foo" as PresetId)).toThrow();
  });
});

describe("formatTimeControlLabel", () => {
  test("Untimed when type is null", () => {
    expect(
      formatTimeControlLabel({
        time_control_type: null,
        time_initial_seconds: null,
        time_increment_seconds: null,
        time_per_move_seconds: null,
      }),
    ).toBe("Untimed");
  });
  test("live with no increment renders 'N min'", () => {
    expect(
      formatTimeControlLabel({
        time_control_type: "live",
        time_initial_seconds: 300,
        time_increment_seconds: 0,
        time_per_move_seconds: null,
      }),
    ).toBe("5 min");
  });
  test("live with increment renders 'N + I'", () => {
    expect(
      formatTimeControlLabel({
        time_control_type: "live",
        time_initial_seconds: 900,
        time_increment_seconds: 10,
        time_per_move_seconds: null,
      }),
    ).toBe("15 + 10");
  });
  test("correspondence renders 'N day/move'", () => {
    expect(
      formatTimeControlLabel({
        time_control_type: "correspondence",
        time_initial_seconds: null,
        time_increment_seconds: null,
        time_per_move_seconds: 86400,
      }),
    ).toBe("1 day/move");
  });
});
