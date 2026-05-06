import { describe, expect, test } from "bun:test";
import {
  computeRemaining,
  formatLive,
  formatCorrespondence,
  tickRateMs,
  LAG_CREDIT_MS,
} from "./clock";

describe("computeRemaining", () => {
  test("inactive side returns stored remaining unchanged", () => {
    const out = computeRemaining({
      remainingMs: 60_000,
      turnStartedAtMs: 0,
      nowMs: 30_000,
      isActive: false,
    });
    expect(out).toBe(60_000);
  });
  test("active side deducts elapsed minus lag credit", () => {
    const out = computeRemaining({
      remainingMs: 60_000,
      turnStartedAtMs: 0,
      nowMs: 5_000,
      isActive: true,
    });
    // 60_000 - 5_000 + 200 = 55_200
    expect(out).toBe(55_200);
  });
  test("clamps at 0 (never negative)", () => {
    const out = computeRemaining({
      remainingMs: 1_000,
      turnStartedAtMs: 0,
      nowMs: 10_000,
      isActive: true,
    });
    expect(out).toBe(0);
  });
  test("turn-started null treats as inactive (no math)", () => {
    const out = computeRemaining({
      remainingMs: 60_000,
      turnStartedAtMs: null,
      nowMs: 5_000,
      isActive: true,
    });
    expect(out).toBe(60_000);
  });
});

describe("formatLive", () => {
  test("MM:SS for >=10s", () => {
    expect(formatLive(125_000)).toBe("2:05");
    expect(formatLive(10_000)).toBe("0:10");
    expect(formatLive(600_000)).toBe("10:00");
  });
  test("M:SS.t for <10s", () => {
    expect(formatLive(9_999)).toBe("0:09.9");
    expect(formatLive(1_500)).toBe("0:01.5");
    expect(formatLive(0)).toBe("0:00.0");
  });
  test("clamps negative input at 0", () => {
    expect(formatLive(-1)).toBe("0:00.0");
  });
});

describe("formatCorrespondence", () => {
  test("Nd Hh for >1h", () => {
    expect(formatCorrespondence(86_400_000)).toBe("1d 0h");
    expect(formatCorrespondence(86_400_000 + 3_600_000 * 4)).toBe("1d 4h");
    expect(formatCorrespondence(3_600_000 + 1)).toBe("0d 1h");
  });
  test("MM:SS for <=1h", () => {
    expect(formatCorrespondence(3_600_000)).toBe("60:00");
    expect(formatCorrespondence(125_000)).toBe("2:05");
    expect(formatCorrespondence(0)).toBe("0:00");
  });
});

describe("tickRateMs", () => {
  test("untimed -> 0 (no tick)", () => {
    expect(tickRateMs("untimed", 1_000_000)).toBe(0);
  });
  test("live, >10s -> 1000ms", () => {
    expect(tickRateMs("live", 30_000)).toBe(1_000);
  });
  test("live, <=10s -> 100ms", () => {
    expect(tickRateMs("live", 9_000)).toBe(100);
  });
  test("correspondence -> 60000ms", () => {
    expect(tickRateMs("correspondence", 86_400_000)).toBe(60_000);
  });
});

describe("LAG_CREDIT_MS", () => {
  test("is 200", () => {
    expect(LAG_CREDIT_MS).toBe(200);
  });
});
