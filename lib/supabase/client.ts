"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Singleton browser client. Multiple createClient() calls returning new
// instances meant each subscription opened its own WebSocket and ran its
// own auth handshake — racing setAuth against the channel join. Sharing
// one client guarantees auth state is consistent across all channels.
let _client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (_client) return _client;
  _client = createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NODE_ENV !== "production"
      ? {
          realtime: {
            params: { log_level: "info" },
          },
        }
      : undefined,
  );
  return _client;
}
