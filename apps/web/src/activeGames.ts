import { getSupabaseClient, hasSupabaseConfig } from "./lib/supabase";

export type TimeControlKind = "live_clock" | "move_deadline";

export type TimeControlPreset = {
  id: string;
  label: string;
  kind: TimeControlKind;
  baseSeconds: number | null;
  incrementSeconds: number;
  moveDeadlineSeconds: number | null;
};

export const timeControlPresets: TimeControlPreset[] = [
  {
    id: "live-10-0",
    label: "10 min",
    kind: "live_clock",
    baseSeconds: 600,
    incrementSeconds: 0,
    moveDeadlineSeconds: null
  },
  {
    id: "live-15-10",
    label: "15 + 10",
    kind: "live_clock",
    baseSeconds: 900,
    incrementSeconds: 10,
    moveDeadlineSeconds: null
  },
  {
    id: "deadline-hourly",
    label: "1 move / hour",
    kind: "move_deadline",
    baseSeconds: null,
    incrementSeconds: 0,
    moveDeadlineSeconds: 3600
  },
  {
    id: "deadline-daily",
    label: "1 move / day",
    kind: "move_deadline",
    baseSeconds: null,
    incrementSeconds: 0,
    moveDeadlineSeconds: 86400
  },
  {
    id: "deadline-weekly",
    label: "1 move / week",
    kind: "move_deadline",
    baseSeconds: null,
    incrementSeconds: 0,
    moveDeadlineSeconds: 604800
  },
  {
    id: "deadline-monthly",
    label: "1 move / month",
    kind: "move_deadline",
    baseSeconds: null,
    incrementSeconds: 0,
    moveDeadlineSeconds: 2592000
  }
];

export type ActiveGameRecord = {
  gameId: string;
  status: "invited" | "active" | "completed" | "abandoned" | "cancelled";
  timeControlKind: TimeControlKind;
  baseSeconds: number | null;
  incrementSeconds: number;
  moveDeadlineSeconds: number | null;
  deadlineAt: string | null;
  rated: boolean;
  cityEditionId: string | null;
  cityLabel: string | null;
  createdAt: string;
  updatedAt: string;
  lastMoveAt: string | null;
  currentTurn: "white" | "black" | null;
  yourSide: "white" | "black" | "spectator";
  yourParticipantStatus: "invited" | "active" | "declined" | "left";
  opponentUserId: string | null;
  opponentUsername: string | null;
  opponentDisplayName: string | null;
  opponentEloRating: number;
  opponentParticipantStatus: "invited" | "active" | "declined" | "left" | null;
  isYourTurn: boolean;
  isIncomingInvite: boolean;
  isOutgoingInvite: boolean;
};

type ActiveGameRow = {
  game_id: string;
  status: ActiveGameRecord["status"];
  time_control_kind: TimeControlKind;
  base_seconds: number | null;
  increment_seconds: number | null;
  move_deadline_seconds: number | null;
  deadline_at: string | null;
  rated: boolean;
  city_edition_id: string | null;
  city_label: string | null;
  created_at: string;
  updated_at: string;
  last_move_at: string | null;
  current_turn: ActiveGameRecord["currentTurn"];
  your_side: ActiveGameRecord["yourSide"];
  your_participant_status: ActiveGameRecord["yourParticipantStatus"];
  opponent_user_id: string | null;
  opponent_username: string | null;
  opponent_display_name: string | null;
  opponent_elo_rating: number | null;
  opponent_participant_status: ActiveGameRecord["opponentParticipantStatus"];
  is_your_turn: boolean;
  is_incoming_invite: boolean;
  is_outgoing_invite: boolean;
};

function mapActiveGameRow(row: ActiveGameRow): ActiveGameRecord {
  return {
    gameId: row.game_id,
    status: row.status,
    timeControlKind: row.time_control_kind,
    baseSeconds: row.base_seconds,
    incrementSeconds: row.increment_seconds ?? 0,
    moveDeadlineSeconds: row.move_deadline_seconds,
    deadlineAt: row.deadline_at,
    rated: row.rated,
    cityEditionId: row.city_edition_id,
    cityLabel: row.city_label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMoveAt: row.last_move_at,
    currentTurn: row.current_turn,
    yourSide: row.your_side,
    yourParticipantStatus: row.your_participant_status,
    opponentUserId: row.opponent_user_id,
    opponentUsername: row.opponent_username,
    opponentDisplayName: row.opponent_display_name,
    opponentEloRating: row.opponent_elo_rating ?? 1200,
    opponentParticipantStatus: row.opponent_participant_status,
    isYourTurn: row.is_your_turn,
    isIncomingInvite: row.is_incoming_invite,
    isOutgoingInvite: row.is_outgoing_invite
  };
}

async function requireAuthenticatedUser() {
  if (!hasSupabaseConfig) {
    return null;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    return null;
  }

  return { supabase, user };
}

export async function listActiveGamesFromSupabase(): Promise<ActiveGameRecord[] | null> {
  const auth = await requireAuthenticatedUser();
  if (!auth) {
    return null;
  }

  const { data, error } = await auth.supabase.rpc("list_active_games");
  if (error) {
    throw error;
  }

  return ((data ?? []) as ActiveGameRow[]).map(mapActiveGameRow);
}

export function getTimeControlPresetById(id: string) {
  return timeControlPresets.find((preset) => preset.id === id) ?? null;
}

export function formatTimeControlLabel(input: {
  timeControlKind: TimeControlKind;
  baseSeconds: number | null;
  incrementSeconds: number;
  moveDeadlineSeconds: number | null;
}) {
  const matchedPreset = timeControlPresets.find((preset) => (
    preset.kind === input.timeControlKind &&
    preset.baseSeconds === input.baseSeconds &&
    preset.incrementSeconds === input.incrementSeconds &&
    preset.moveDeadlineSeconds === input.moveDeadlineSeconds
  ));

  if (matchedPreset) {
    return matchedPreset.label;
  }

  if (input.timeControlKind === "live_clock" && input.baseSeconds) {
    const minutes = Math.round(input.baseSeconds / 60);
    return input.incrementSeconds > 0 ? `${minutes} + ${input.incrementSeconds}` : `${minutes} min`;
  }

  if (input.moveDeadlineSeconds) {
    const seconds = input.moveDeadlineSeconds;
    if (seconds % 2592000 === 0) {
      return `${seconds / 2592000} move / month`;
    }
    if (seconds % 604800 === 0) {
      return `${seconds / 604800} move / week`;
    }
    if (seconds % 86400 === 0) {
      return `${seconds / 86400} move / day`;
    }
    if (seconds % 3600 === 0) {
      return `${seconds / 3600} move / hour`;
    }
  }

  return input.timeControlKind === "live_clock" ? "Live clock" : "Move deadline";
}

export async function createGameInviteInSupabase(input: {
  opponentUsername: string;
  cityEditionId: string | null;
  timeControlPresetId: string;
  rated: boolean;
}): Promise<string> {
  const auth = await requireAuthenticatedUser();
  if (!auth) {
    throw new Error("Sign in to create a multiplayer game.");
  }

  const preset = getTimeControlPresetById(input.timeControlPresetId);
  if (!preset) {
    throw new Error("Choose a valid time control.");
  }

  const { data, error } = await auth.supabase.rpc("create_game_invite", {
    p_opponent_username: input.opponentUsername.trim().toLowerCase(),
    p_city_edition_id: input.cityEditionId,
    p_time_control_kind: preset.kind,
    p_base_seconds: preset.baseSeconds,
    p_increment_seconds: preset.incrementSeconds,
    p_move_deadline_seconds: preset.moveDeadlineSeconds,
    p_rated: input.rated
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row?.game_id) {
    throw error ?? new Error("Could not create the multiplayer invite.");
  }

  return row.game_id as string;
}

export async function respondToGameInviteInSupabase(input: {
  gameId: string;
  response: "accept" | "decline";
}): Promise<void> {
  const auth = await requireAuthenticatedUser();
  if (!auth) {
    throw new Error("Sign in to respond to multiplayer invites.");
  }

  const { error } = await auth.supabase.rpc("respond_to_game_invite", {
    p_game_id: input.gameId,
    p_response: input.response
  });

  if (error) {
    throw error;
  }
}
