"use client";

import { createClient } from "@/lib/supabase/client";
import { ObserverPresenceEventSchema } from "@/lib/schemas/game";

const DEV = process.env.NODE_ENV !== "production";

/**
 * Hash userId + gameId to a stable opaque presence key. Avoids leaking
 * raw user_ids to other clients via channel.presenceState().
 *
 * Uses a small synchronous string hash; collision risk between two real
 * users on the same game is astronomically low for our scale (we just
 * want "distinct connections by user, but not user-id-recoverable").
 */
function presenceKey(userId: string, gameId: string): string {
  // FNV-1a over userId + ":" + gameId, hex-encoded.
  const input = `${userId}:${gameId}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ("0000000" + (h >>> 0).toString(16)).slice(-8);
}

export async function joinObserverPresence(
  gameId: string,
  myUserId: string,
  onCount: (count: number) => void,
): Promise<{ leave: () => void }> {
  const supabase = createClient();

  // Realtime auth-before-subscribe per phase 5 lesson.
  const { data } = await supabase.auth.getSession();
  if (data.session) supabase.realtime.setAuth(data.session.access_token);

  const key = presenceKey(myUserId, gameId);
  const channel = supabase.channel(`game:observers:${gameId}`, {
    config: { presence: { key } },
  });

  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState();
    onCount(Object.keys(state).length);
    if (DEV) console.log("[presence] sync, state keys", Object.keys(state).length);
  });

  await channel.subscribe(async (status) => {
    if (DEV) console.log("[presence] status", status);
    if (status === "SUBSCRIBED") {
      const event: { joined_at: string } = {
        joined_at: new Date().toISOString(),
      };
      // Validate our own emit so a schema drift catches early.
      const parsed = ObserverPresenceEventSchema.safeParse(event);
      if (parsed.success) await channel.track(parsed.data);
    }
  });

  return {
    leave: () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    },
  };
}
