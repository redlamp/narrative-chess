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

export function subscribeToMoves(
  gameId: string,
  onMove: (m: MoveEvent) => void,
  onStatus?: (s: SubscribeStatus) => void,
): { unsubscribe: () => void } {
  const supabase = createClient();
  onStatus?.("subscribing");

  // Ensure realtime sees the latest auth token. createBrowserClient from
  // @supabase/ssr does not always propagate the access token to the
  // realtime socket on first mount; without it, postgres_changes RLS
  // silently denies row delivery.
  void supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
      void supabase.realtime.setAuth(data.session.access_token);
      if (DEV) console.log("[realtime] setAuth ok for moves channel", { gameId });
    } else if (DEV) {
      console.warn("[realtime] no session for moves channel", { gameId });
    }
  });

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

export function subscribeToGameStatus(
  gameId: string,
  onUpdate: (u: GameStatusUpdateEvent) => void,
): { unsubscribe: () => void } {
  const supabase = createClient();

  void supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
      void supabase.realtime.setAuth(data.session.access_token);
      if (DEV) console.log("[realtime] setAuth ok for status channel", { gameId });
    } else if (DEV) {
      console.warn("[realtime] no session for status channel", { gameId });
    }
  });

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
