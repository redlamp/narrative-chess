// M1.5++ clock math. Pure functions — no DOM, no Date.now() defaults.
// Server side mirrors the same elapsed math (with 200ms lag credit subtracted
// from elapsed); client interpolation adds 200ms back so display matches what
// the server will deduct on the next move.

export const LAG_CREDIT_MS = 200;

export type ClockMode = "untimed" | "live" | "correspondence";

export function computeRemaining(args: {
  remainingMs: number;
  turnStartedAtMs: number | null;
  nowMs: number;
  isActive: boolean;
}): number {
  const { remainingMs, turnStartedAtMs, nowMs, isActive } = args;
  if (!isActive || turnStartedAtMs === null) return remainingMs;
  const elapsed = nowMs - turnStartedAtMs;
  const adjusted = remainingMs - elapsed + LAG_CREDIT_MS;
  return adjusted > 0 ? adjusted : 0;
}

export function formatLive(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe >= 10_000) {
    const totalSec = Math.floor(safe / 1_000);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    return `${mm}:${ss.toString().padStart(2, "0")}`;
  }
  const totalTenths = Math.floor(safe / 100);
  const sec = Math.floor(totalTenths / 10);
  const tenth = totalTenths % 10;
  return `0:${sec.toString().padStart(2, "0")}.${tenth}`;
}

export function formatCorrespondence(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe > 3_600_000) {
    const days = Math.floor(safe / 86_400_000);
    const hours = Math.floor((safe % 86_400_000) / 3_600_000);
    return `${days}d ${hours}h`;
  }
  const totalSec = Math.floor(safe / 1_000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

export function tickRateMs(mode: ClockMode, displayedMs: number): number {
  if (mode === "untimed") return 0;
  if (mode === "correspondence") return 60_000;
  // live
  return displayedMs <= 10_000 ? 100 : 1_000;
}
