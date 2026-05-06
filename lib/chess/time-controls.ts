import type { TimeControlType } from "@/lib/schemas/game";

export type PresetId = "untimed" | "5min" | "10min" | "15+10" | "1day";

export type TimeControlPreset = {
  id: PresetId;
  label: string;
  timeControlType: TimeControlType;
  timeInitialSeconds?: number;
  timeIncrementSeconds?: number;
  timePerMoveSeconds?: number;
};

export const TIME_CONTROL_PRESETS: ReadonlyArray<TimeControlPreset> = [
  { id: "untimed", label: "Untimed", timeControlType: null },
  {
    id: "5min",
    label: "5 min",
    timeControlType: "live",
    timeInitialSeconds: 300,
    timeIncrementSeconds: 0,
  },
  {
    id: "10min",
    label: "10 min",
    timeControlType: "live",
    timeInitialSeconds: 600,
    timeIncrementSeconds: 0,
  },
  {
    id: "15+10",
    label: "15 + 10",
    timeControlType: "live",
    timeInitialSeconds: 900,
    timeIncrementSeconds: 10,
  },
  {
    id: "1day",
    label: "1 day / move",
    timeControlType: "correspondence",
    timePerMoveSeconds: 86400,
  },
];

export function presetById(id: PresetId): TimeControlPreset {
  const found = TIME_CONTROL_PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`unknown preset id: ${id}`);
  return found;
}

// Format a games-row's time control as a short label for badges + join screen.
export function formatTimeControlLabel(g: {
  time_control_type: string | null;
  time_initial_seconds: number | null;
  time_increment_seconds: number | null;
  time_per_move_seconds: number | null;
}): string {
  if (!g.time_control_type) return "Untimed";
  if (g.time_control_type === "live") {
    const minutes = Math.round((g.time_initial_seconds ?? 0) / 60);
    const inc = g.time_increment_seconds ?? 0;
    return inc > 0 ? `${minutes} + ${inc}` : `${minutes} min`;
  }
  const days = Math.round((g.time_per_move_seconds ?? 0) / 86_400);
  return days >= 1 ? `${days} day/move` : `${g.time_per_move_seconds ?? 0}s/move`;
}
