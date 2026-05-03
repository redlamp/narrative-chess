---
tags:
  - domain/realtime
  - domain/supabase
  - status/adopted
  - origin/manual-smoke
---

# Lesson — Supabase Realtime: setAuth Before Subscribe

## Symptom

A `postgres_changes` channel subscribes successfully — the client logs `SUBSCRIBED` and the WebSocket handshake completes — but no INSERT / UPDATE events arrive. RLS is configured correctly: the user CAN see the rows via a normal `from(...).select(...)`. Two browsers in the same game see different states; opponent's moves never propagate without a manual page refresh.

## Cause

Supabase Realtime registers each channel subscription with the user's JWT at the moment `phx_join` is sent over the WebSocket. If the JWT isn't on the realtime client when phx_join goes out, the server records the subscription as **anonymous** — the row in `realtime.subscription` has `user_sub = NULL`. RLS policies that check `auth.uid() = ...` then return false for every row, and the server silently drops every event for that subscription.

`@supabase/ssr`'s `createBrowserClient` does not always propagate the access token to the realtime socket on first mount. The token is set asynchronously after the auth state hydrates from cookies; meanwhile the channel might already be subscribing.

## Diagnostic

Query the realtime schema directly to confirm:

```sql
select claims->>'sub' as user_sub, entity, filters, created_at
from realtime.subscription
order by created_at desc
limit 10;
```

`user_sub = NULL` on a subscription that should be authenticated is the smoking gun.

## Fix

Make subscription setup async. Await `getSession()` and call `realtime.setAuth(token)` BEFORE creating the channel. Both calls are cheap:

```ts
async function authRealtime(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    supabase.realtime.setAuth(data.session.access_token);
    return true;
  }
  return false;
}

export async function subscribeToMoves(gameId, onMove) {
  const supabase = createClient();
  await authRealtime(supabase);
  const channel = supabase
    .channel(`moves:${gameId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_moves", filter: `game_id=eq.${gameId}` }, ...)
    .subscribe();
  return { unsubscribe: () => supabase.removeChannel(channel) };
}
```

`setAuth` itself is synchronous — only `getSession()` is async. Once awaited, the channel's phx_join carries the JWT and `realtime.subscription.user_sub` is populated.

## Related

- Phase 5 commit `0813c6a` shipped this fix.
- Verified via `realtime.subscription` query during the manual two-browser smoke.
- See also: `wiki/notes/realtime-rls-gate-procedure.md` for the manual gate that should catch realtime failures before they reach production.

## Source

Discovered during M1 ship preparation, 2026-05-03. Apply to any future Supabase project that uses `postgres_changes`.
