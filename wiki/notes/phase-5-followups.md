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

### Realtime moves do not propagate to the other browser

**Status:** investigating (2026-05-03 session)

**Symptoms:**
- Player 1 makes a move; player 2 does not see it without a manual browser refresh.
- Both browsers must reload to see the latest state.
- Turn enforcement appears wrong on the stale side (because `state.fen` is stale, `myTurn` is computed from old fen).

**Suspected causes (ranked):**
1. Browser realtime client not authenticated against Supabase realtime — RLS blocks the SELECT that backs the postgres_changes event delivery. `@supabase/ssr`'s `createBrowserClient` should sync auth automatically, but may not be invoking `realtime.setAuth(...)` after sign-in in this version.
2. Subscription connects but events never arrive due to filter mismatch or RLS denial.
3. WebSocket connection itself failing silently — needs DevTools Network → WS frame inspection.

**Next steps:**
- Add verbose logging in `lib/realtime/subscribe.ts` to log channel status transitions and every payload received (dev-only).
- Run dev server and capture DevTools console output during a two-browser session.
- If WS shows no INSERT events arriving, suspect realtime auth — call `supabase.realtime.setAuth(session.access_token)` in `lib/supabase/client.ts` after `getSession()`.

### Drag UX: piece snaps back, then snaps to target

**Status:** known consequence of the optimistic-then-reconcile pattern in `app/games/[gameId]/GameClient.tsx`.

**Symptoms:** When user drops a piece, the board briefly shows it returning to source, then jumps to target — visible flicker.

**Root cause:** `react-chessboard@4.7` exposes a sync `onPieceDrop` returning `boolean`. The implementation returns `true` to commit visually, then awaits the server. While awaiting, the controlled `position` prop hasn't updated, so any internal re-render makes the library snap back to the prior position. Once `applyMoveLocal` updates `position`, the library re-syncs to the new fen.

**Possible fixes:**
- Manually update local `state.fen` to the chess.js-computed post-move fen in `onPieceDrop` before returning `true`. Reconcile to server-confirmed fen on success (idempotent if same), or revert to pre-move fen on failure.
- Or: switch to click-to-move via `onSquareClick` (no DnD flicker possible).

## Medium priority — Next.js 16 deprecation

### `middleware.ts` → `proxy.ts` rename

**Symptom:** dev server logs `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` See URL → https://nextjs.org/docs/messages/middleware-to-proxy

**Action:** rename `middleware.ts` → `proxy.ts` (or whatever Next.js 16 docs prescribe), update any imports/exports, verify auth session refresh still works.

**Scope:** small — single-file rename + Next.js docs read.

## Lower priority — code quality (deferred from Task 8 review)

- Memoize `computeMyTurn` once per render in `app/games/[gameId]/GameClient.tsx` (currently invoked twice per render with `new Chess(fen)` inside).
- Extract react-chessboard type re-exports to `lib/chess/board-types.ts` so the deep `dist/` import is centralized to one file.
- `data-fen` on the test hook is unused by current e2e specs — comment its intent or drop.

## See also

- `docs/superpowers/specs/2026-05-03-v2-phase-5-board-realtime-design.md` — phase 5 design
- `wiki/notes/realtime-rls-gate-procedure.md` — manual realtime sanity check
