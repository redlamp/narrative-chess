"use client";

import {
  MoveEventSchema,
  GameStatusUpdateEventSchema,
  type MoveEvent,
  type GameStatusUpdateEvent,
} from "@/lib/schemas/game";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function parseMoveEvent(raw: unknown): MoveEvent | null {
  const r = MoveEventSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export function parseGameStatusUpdate(raw: unknown): GameStatusUpdateEvent | null {
  const r = GameStatusUpdateEventSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export type SubscribeStatus = "idle" | "subscribing" | "subscribed" | "error";

const DEV = process.env.NODE_ENV !== "production";

/**
 * Ensure the singleton realtime client has the current user's access token
 * before any channel subscribes. Without this, the channel's phx_join
 * frame goes out anonymous and `realtime.subscription.user_sub` ends up
 * null on the server, so RLS evaluates auth.uid() = null and no rows are
 * delivered. setAuth is synchronous; we await getSession() once.
 */
async function authRealtime(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    supabase.realtime.setAuth(data.session.access_token);
    return true;
  }
  return false;
}

export async function subscribeToMoves(
  gameId: string,
  onMove: (m: MoveEvent) => void,
  onStatus?: (s: SubscribeStatus) => void,
): Promise<{ unsubscribe: () => void }> {
  const supabase = createClient();
  onStatus?.("subscribing");

  const authed = await authRealtime(supabase);
  if (DEV) console.log("[realtime] moves channel auth", { gameId, authed });

  const channel: RealtimeChannel = supabase
    .channel(`moves:${gameId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "game_moves",
        filter: `game_id=eq.${gameId}`,
      },
      (payload) => {
        if (DEV) console.log("[realtime] moves INSERT payload", payload);
        const m = parseMoveEvent(payload.new);
        if (m) onMove(m);
        else if (DEV) {
          console.error("[realtime] dropped malformed move payload", payload.new);
        }
      },
    )
    .subscribe((status, err) => {
      if (DEV) console.log("[realtime] moves channel status", status, err ?? "");
      if (status === "SUBSCRIBED") onStatus?.("subscribed");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onStatus?.("error");
    });

  return {
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
  };
}

export async function subscribeToGameStatus(
  gameId: string,
  onUpdate: (u: GameStatusUpdateEvent) => void,
): Promise<{ unsubscribe: () => void }> {
  const supabase = createClient();

  const authed = await authRealtime(supabase);
  if (DEV) console.log("[realtime] status channel auth", { gameId, authed });

  const channel: RealtimeChannel = supabase
    .channel(`game_status:${gameId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "games",
        filter: `id=eq.${gameId}`,
      },
      (payload) => {
        if (DEV) console.log("[realtime] status UPDATE payload", payload);
        const u = parseGameStatusUpdate(payload.new);
        if (u) onUpdate(u);
        else if (DEV) {
          console.error("[realtime] dropped malformed status payload", payload.new);
        }
      },
    )
    .subscribe((status, err) => {
      if (DEV) console.log("[realtime] status channel status", status, err ?? "");
    });

  return {
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
  };
}
