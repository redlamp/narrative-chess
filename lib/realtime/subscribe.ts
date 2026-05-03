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

export function subscribeToMoves(
  gameId: string,
  onMove: (m: MoveEvent) => void,
  onStatus?: (s: SubscribeStatus) => void,
): { unsubscribe: () => void } {
  const supabase = createClient();
  onStatus?.("subscribing");
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
        const m = parseMoveEvent(payload.new);
        if (m) onMove(m);
        else if (process.env.NODE_ENV !== "production") {
          console.error("subscribeToMoves: dropped malformed payload", payload.new);
        }
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") onStatus?.("subscribed");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onStatus?.("error");
    });

  return {
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
  };
}

export function subscribeToGameStatus(
  gameId: string,
  onUpdate: (u: GameStatusUpdateEvent) => void,
): { unsubscribe: () => void } {
  const supabase = createClient();
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
        const u = parseGameStatusUpdate(payload.new);
        if (u) onUpdate(u);
        else if (process.env.NODE_ENV !== "production") {
          console.error("subscribeToGameStatus: dropped malformed payload", payload.new);
        }
      },
    )
    .subscribe();

  return {
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
  };
}
