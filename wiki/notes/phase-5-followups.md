---
tags:
  - domain/chess-engine
  - domain/realtime
  - status/open
  - scope/m1
  - origin/manual-smoke
---

# Phase 5 Followups

Backlog of items surfaced during phase 5 implementation and the post-PR manual two-browser smoke. Tracked here rather than in GitHub Issues for now; promote to issues if the list grows.

## High priority — found during manual smoke

### Realtime moves do not propagate to the other browser — RESOLVED

**Status:** resolved 2026-05-03. Committed in `0813c6a` (await setAuth before subscribing) preceded by `8a1b5d6` (singleton browser client + verbose realtime logs) and `cac3e16` (initial setAuth attempt + dev logging).

**Root cause:** `setAuth` was firing in a fire-and-forget promise; `.subscribe()` ran synchronously and sent the `phx_join` frame to the realtime server BEFORE setAuth resolved. The server-side `realtime.subscription` row was created with `user_sub = null` (anonymous), so RLS on `game_moves` evaluated `auth.uid() = null` and silently denied every row delivery. Confirmed by querying `realtime.subscription` via Supabase MCP after a failed two-browser smoke.

**Fix:** converted `subscribeToMoves` and `subscribeToGameStatus` to async; `await getSession()` and call `setAuth` (synchronous) before creating the channel. `GameClient` and `WaitingForOpponent` useEffects updated with a cancelled-flag pattern so unsubscribe still fires correctly if the component unmounts before the subscription is established.

**Lesson:** when a Supabase realtime subscription appears to subscribe successfully but no events arrive, query `select user_sub from realtime.subscription order by created_at desc` — `null` means the JWT didn't make it to the phx_join frame.

### Drag UX: piece snaps back, then snaps to target

**Status:** known consequence of the optimistic-then-reconcile pattern in `app/games/[gameId]/GameClient.tsx`.

**Symptoms:** When user drops a piece, the board briefly shows it returning to source, then jumps to target — visible flicker.

**Root cause:** `react-chessboard@4.7` exposes a sync `onPieceDrop` returning `boolean`. The implementation returns `true` to commit visually, then awaits the server. While awaiting, the controlled `position` prop hasn't updated, so any internal re-render makes the library snap back to the prior position. Once `applyMoveLocal` updates `position`, the library re-syncs to the new fen.

**Possible fixes:**
- Manually update local `state.fen` to the chess.js-computed post-move fen in `onPieceDrop` before returning `true`. Reconcile to server-confirmed fen on success (idempotent if same), or revert to pre-move fen on failure.
- Or: switch to click-to-move via `onSquareClick` (no DnD flicker possible).

## Medium priority — Next.js 16 deprecation — RESOLVED

### `middleware.ts` → `proxy.ts` rename

**Status:** resolved 2026-05-03. Committed in `98217e1`.

Renamed root `middleware.ts` → `proxy.ts` with exported function `middleware` → `proxy`. Also renamed helper `lib/supabase/middleware.ts` → `lib/supabase/proxy.ts` for vocabulary consistency. Behavior unchanged — auth session refresh still runs on every matched request.

Reference URL → https://nextjs.org/docs/messages/middleware-to-proxy

## Lower priority — code quality (deferred from Task 8 review)

- Memoize `computeMyTurn` once per render in `app/games/[gameId]/GameClient.tsx` (currently invoked twice per render with `new Chess(fen)` inside).
- Extract react-chessboard type re-exports to `lib/chess/board-types.ts` so the deep `dist/` import is centralized to one file.
- `data-fen` on the test hook is unused by current e2e specs — comment its intent or drop.

## See also

- `docs/superpowers/specs/2026-05-03-v2-phase-5-board-realtime-design.md` — phase 5 design
- `wiki/notes/realtime-rls-gate-procedure.md` — manual realtime sanity check
