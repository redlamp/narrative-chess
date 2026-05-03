---
tags:
  - domain/chess-engine
  - domain/realtime
  - status/adopted
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

### Drag UX: piece snaps back, then snaps to target — RESOLVED

**Status:** resolved 2026-05-03 on `feat/phase-5-polish`. Committed in `927b40b`.

**Approach taken:** optimistic fen update inside `onPieceDrop` / `onPromotionPieceSelect` synchronously to chess.js's computed post-move fen, BEFORE returning `true`. The controlled `position` prop now matches the library's internal state on the next render — no snap-back. ply intentionally stays at the canonical (server-confirmed) value during the optimistic window so a concurrent opponent move at ply+1 still passes the `applyMoveLocal` ply guard. Rollback via a ref-tracked optimistic fen — only fires if state.fen still equals our optimistic (otherwise realtime has already replaced it with the opponent's truth, which we leave alone).

## Medium priority — Next.js 16 deprecation — RESOLVED

### `middleware.ts` → `proxy.ts` rename

**Status:** resolved 2026-05-03. Committed in `98217e1`.

Renamed root `middleware.ts` → `proxy.ts` with exported function `middleware` → `proxy`. Also renamed helper `lib/supabase/middleware.ts` → `lib/supabase/proxy.ts` for vocabulary consistency. Behavior unchanged — auth session refresh still runs on every matched request.

Reference URL → https://nextjs.org/docs/messages/middleware-to-proxy

## Lower priority — code quality (deferred from Task 8 review) — RESOLVED

All three items resolved 2026-05-03 on `feat/phase-5-polish`:
- `f511c22` — drop unused `data-fen` from the test hook + add `aria-hidden`.
- `e77e8cb` — extract react-chessboard type re-exports to `lib/chess/board-types.ts`.
- `6306007` — memoize `fen.turn()` once per render via `useMemo` keyed on `state.fen`.

## UX additions from manual smoke — RESOLVED

All landed in PR #9 (squashed to dev as `eaf38e0`):

- **Sidebar redesign** — single horizontal row of three pills, team-colored (black bg / white bg), turn pill in the middle adopts the active side's palette and shows a directional arrow (◀ / ▶). Active player name pill gets an amber ring. (commit `98a5571`)
- **`(you)` marker** moved next to the side label rather than next to the player name, so longer display names no longer wrap. (`7701587`)
- **Drag-restrict** to the side-to-move's own pieces via `isDraggablePiece` — opponent's pieces and own pieces on opponent's turn are no longer draggable. (`a078bbb`)
- **King-in-check / checkmate** square highlight on the board (amber / red @ ~55%). (`a078bbb`)
- **Player namecard overlay** — same amber / red palette at ~60% alpha on the affected player's pill so the team color stays legible underneath. Status pill text promotes to "Check", "Check — your move", "Checkmate", "Checkmate — you lose". (`1990388`)
- **Click-to-move** with two-step interaction (select → click target). Promotion via click defaults to queen; drag-promotion still routes through the library dialog for non-queen pieces. (`d1d751b`)
- **Legal-target circles** — small dot on empty squares, inset ring on capture squares (lichess-style). (`d1d751b`, restored in `4d7e080`)
- **Hover-confirm border** — when a piece is selected (click) or being dragged AND the mouse is over a legal target, that square gets a strong amber inset border layered above the circle. (`4d7e080`)
- **Drag also lights legal targets** — `onPieceDragBegin` records the drag source so the same legal-target circles light up while dragging. (`f3b14cd`)

## Observer mode — RESOLVED

Any authenticated user with the URL can watch a game live (read-only). RLS widened with two new policies (one per table) so realtime postgres_changes delivers INSERTs to non-participant subscribers. Writes still require participant status (enforced by RPCs). Trust model: unguessable UUID gameId IS the access grant — same as the existing share-URL-to-join pattern. A `games.public` boolean for strict-private games is left for when a real product need surfaces. (commit `29a5e63`, migration `20260503124751_add_observer_select_policies.sql`)

## See also

- `docs/superpowers/specs/2026-05-03-v2-phase-5-board-realtime-design.md` — phase 5 design
- `wiki/notes/realtime-rls-gate-procedure.md` — manual realtime sanity check
