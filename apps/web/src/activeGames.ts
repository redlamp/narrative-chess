import { getSupabaseClient, hasSupabaseConfig } from "./lib/supabase";

export type ActiveGamePlayMode = "sync" | "async";

export type ActiveGameRecord = {
  gameId: string;
  status: "invited" | "active" | "completed" | "abandoned" | "cancelled";
  playMode: ActiveGamePlayMode;
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
  play_mode: ActiveGamePlayMode;
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
    playMode: row.play_mode,
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

export async function createGameInviteInSupabase(input: {
  opponentUsername: string;
  cityEditionId: string | null;
  playMode: ActiveGamePlayMode;
  rated: boolean;
}): Promise<string> {
  const auth = await requireAuthenticatedUser();
  if (!auth) {
    throw new Error("Sign in to create a multiplayer game.");
  }

  const { data, error } = await auth.supabase.rpc("create_game_invite", {
    p_opponent_username: input.opponentUsername.trim().toLowerCase(),
    p_city_edition_id: input.cityEditionId,
    p_play_mode: input.playMode,
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
