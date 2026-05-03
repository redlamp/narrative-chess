# V2 Phase 5 — Board UI + Realtime Sync (Step K) Design

**Date:** 2026-05-03
**Status:** Draft, pending implementation
**Spec ref:** `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` §6.4 (realtime), §6.5 (repo layout), §7 Step K
**Predecessor phases:** 1–4 shipped. `make_move` RPC + chess.js engine + Server Action `makeMove` already in place.

## 1. Context

Phases 1–4 built the server foundation: schema, RLS, realtime publication, `make_move` RPC, the chess.js engine wrapper, and the `makeMove` Server Action. Two real users still cannot sit down and play — there is no game UI, no realtime client subscription, and no flow for creating or joining games. Phase 5 closes that gap with the smallest possible playable slice.

Phase 5 is **scope B** (slim playable): one new-game route, one game route, a board component, a realtime subscription. Game lobby, resign / abort, terminal-state banners, and move-list UI are deferred to phase 6.

## 2. Goals

- Two real users in two browsers can sign up, create a game, share a URL, and play a complete game with realtime move sync.
- Multiplayer chess feels correct: opponent moves appear within ~1s; concurrent moves are resolved deterministically; illegal moves are rejected with clear feedback.
- All file invariants from `CLAUDE.md` hold: chess.js stays in `lib/chess/engine.ts`, DB writes go through Server Actions only, RLS lives in the same migration as the table or RPC it guards.
- End-to-end test coverage for the happy path, the concurrency-conflict race, and the join-race race.

## 3. Non-goals (deferred to phase 6)

- Game lobby (`app/games/page.tsx`), open-challenge discovery list.
- Resign, abort, draw offer.
- Terminal-state banner UI ("White wins by checkmate" with replay button).
- Move list / scrollable history panel.
- Player presence (online indicator), reconnect pill.
- Pre-move queueing.
- Mobile / touch optimization (M1 is desktop-first).
- A11y audit (deferred — react-chessboard has its own a11y story; we accept it as-is for M1).

## 4. Architecture

### 4.1 Component + route layout

```
app/
  games/
    new/
      page.tsx              -- Server. Auth gate. Renders <NewGameForm>.
      NewGameForm.tsx       -- Client. Side picker -> Server Action.
      actions.ts            -- 'use server'. createGame(input).
    [gameId]/
      page.tsx              -- Server. Fetches game row + display names.
                            --   Branches to <GameClient>, <JoinGameForm>,
                            --   or <WaitingForOpponent> based on viewer + status.
      GameClient.tsx        -- Client. Board + sidebar + realtime subscription.
      JoinGameForm.tsx      -- Client. Single button "Join as <color>".
      WaitingForOpponent.tsx -- Client. Share URL + listens for status flip.
      actions.ts            -- 'use server'. Already has makeMove from phase 4;
                            --   add joinGame.

components/
  ui/
    sonner.tsx              -- shadcn-installed Toaster root.

lib/
  realtime/
    subscribe.ts            -- subscribeToMoves(gameId, onMove).
                            -- subscribeToGameStatus(gameId, onUpdate).
  schemas/
    game.ts                 -- Zod: CreateGameInput, JoinGameInput,
                            --   GameRow, MoveEvent, GameStatusUpdateEvent.
                            --   Reuses GameStatus from move.ts.
    move.ts                 -- (existing — phase 4. Exports GameStatus enum.)

supabase/
  migrations/
    <ts>_create_game_and_join_rpc.sql  -- create_game + join_open_game RPCs.
```

### 4.2 RPCs

Two new RPCs, both `SECURITY DEFINER`, both `grant execute … to authenticated`. RLS does not gate function calls; each RPC re-checks `auth.uid()` and authorization explicitly.

#### `create_game(p_my_color text) returns uuid`

Inputs: `p_my_color` ∈ `{'white','black'}`. (Random selection happens in the Server Action, not the RPC.)

Behavior:
1. Reject if `auth.uid() is null`.
2. Insert row into `public.games`:
   - Caller into `white_id` or `black_id` per `p_my_color`.
   - Other side `null`.
   - `status = 'open'`.
   - `current_fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'`.
   - `current_turn = 'w'`.
   - `ply = 0`.
3. Return new game id.

#### `join_open_game(p_game_id uuid) returns public.games`

Behavior:
1. Reject if `auth.uid() is null`.
2. Lock target row: `select … from public.games where id = p_game_id for update`.
3. Reject `not_found` if row missing.
4. Reject `not_open` if `status <> 'open'`.
5. Reject `already_a_participant` if `auth.uid()` is already in `white_id` or `black_id`.
6. Determine the empty side:
   - If `white_id is null` → set `white_id = auth.uid()`.
   - Else if `black_id is null` → set `black_id = auth.uid()`.
   - Else raise `already_filled`.
7. Update row in single statement; flip `status = 'in_progress'`.
8. Return updated row.

The row lock plus single UPDATE serializes concurrent joiners. Loser of a race gets `already_filled`.

### 4.3 State model (client)

`GameClient` owns one piece of state:

```ts
type GameState = {
  fen: string;            // canonical board position
  ply: number;            // monotonic; guards reordered events
  status: GameStatus;     // 'in_progress' | 'white_won' | 'black_won' | 'draw' | 'aborted'
  pending: boolean;       // true while makeMove is in flight
};
```

Plus three immutable props from the server: `gameId`, `myColor`, `initialState`.

Derived per render:
- `myTurn = (chess.js .turn() on fen) === myColor && status === 'in_progress' && !pending`.
- Sidebar text and turn indicator are pure functions of state + props.

**Reconciliation rule (key invariant):** server is the source of truth. Local state only changes via three funnels, all using functional setState with a ply-monotonic guard:

```ts
// Move application: status is optional because the realtime
// game_moves INSERT payload does not carry status (it's a column on
// public.games, not public.game_moves). The makeMove Server Action's
// return DOES include status because the action reads from the RPC's
// returning row.
function applyMove(next: { ply: number; fen: string; status?: GameStatus }) {
  setState(prev => {
    if (next.ply <= prev.ply) return prev;
    return {
      ...prev,
      ply: next.ply,
      fen: next.fen,
      status: next.status ?? prev.status,
    };
  });
}

// Status-only updates from the games UPDATE subscription (e.g.,
// open -> in_progress on join, in_progress -> aborted on resign).
function applyStatus(status: GameStatus) {
  setState(prev => ({ ...prev, status }));
}
```

`applyMove` is called from (a) `makeMove` Server Action success — passes `{ ply, fen, status }`; (b) realtime `game_moves` INSERT handler — passes `{ ply, fen }`. Either order is race-safe.

`applyStatus` is called from the `games` UPDATE subscription handler.

### 4.4 Data flow

#### Hydrate page

1. Client navigates to `/games/<id>`.
2. `app/games/[gameId]/page.tsx` (server):
   - `getUser()`. Redirect to `/login?next=/games/<id>` if unauthenticated.
   - Validate `params.gameId` as UUID via Zod. `notFound()` if malformed.
   - Single query:
     ```sql
     select g.id, g.white_id, g.black_id, g.current_fen, g.ply, g.status,
            g.current_turn,
            wp.display_name as white_name,
            bp.display_name as black_name
     from public.games g
       left join public.profiles wp on wp.user_id = g.white_id
       left join public.profiles bp on bp.user_id = g.black_id
     where g.id = $1;
     ```
   - `notFound()` if no row (RLS will hide rows the viewer can't see).
3. Compute viewer relationship (let `uid = auth.uid()`):
   - `viewerIsWhite = uid === white_id`
   - `viewerIsBlack = uid === black_id`
   - `viewerIsParticipant = viewerIsWhite || viewerIsBlack`
   - `emptySide = white_id is null ? 'white' : black_id is null ? 'black' : null`
4. Branch:
   - `status = 'open'` AND `viewerIsParticipant` → `<WaitingForOpponent gameId=… shareUrl=… />`.
   - `status = 'open'` AND `!viewerIsParticipant` AND `emptySide !== null` → `<JoinGameForm gameId=… emptySide=… />`.
   - `viewerIsParticipant` AND status ≠ `'open'` → `<GameClient initialState=… myColor=… opponentName=… />`.
   - Else → `notFound()` (covers: non-participant viewing non-`'open'` game; degenerate state where status='open' but no empty side).

#### Make a move (own side)

1. User drags e2 → e4. `<Chessboard onPieceDrop>` fires.
2. Handler returns `false` early if `!myTurn || pending || status !== 'in_progress'`.
3. Client-side pre-validate via `validateMove(fen, uci)` from `lib/chess/engine.ts`. If illegal locally → return `false` (snap back, no toast, no network call). Server remains authoritative.
4. `setPending(true)`. `await makeMove({ gameId, uci, expectedPly: ply })`.
5. On `ok:true` → `applyMove({ ply: result.ply, fen: result.fen_after, status: result.status })`. Toast "Game over" if status terminal. Return `true`.
6. On `ok:false` → toast per error-code map (below). On `concurrency_conflict` also call `router.refresh()`. On `unauthenticated` redirect to `/login?next=…`. Return `false`.
7. `finally`: `setPending(false)`.

#### Receive opponent move

1. `subscribeToMoves(gameId, onMove)` is established in a `useEffect` on mount; cleanup removes the channel.
2. `postgres_changes` fires INSERT on `game_moves` filtered by `game_id`.
3. Handler Zod-parses payload via `MoveEventSchema` (fields: `game_id`, `ply`, `san`, `uci`, `fen_after`, `played_by`, `played_at`). Drop on parse failure (log to console.error in dev).
4. `applyMove({ ply, fen: fen_after })` — no `status` field on `game_moves`. Ply guard rejects echoes of own already-applied move.

The server `make_move` RPC writes to `games` (atomic update) AND inserts into `game_moves` in the same transaction. Realtime publication is on `game_moves`, so opponents and the mover both receive an INSERT event with `fen_after`. The `applyMove` ply-guard makes the redundant echo to the mover a no-op.

Status transitions (terminal moves) come through the same path: `make_move` RPC sets `games.status` and inserts the move; the realtime payload contains the new fen, and `GameStatus` is fetched via a parallel `games` UPDATE subscription (next section).

#### Game status updates

For non-move status transitions (open → in_progress on join, in_progress → aborted/terminal on resign in phase 6), subscribe to `games` UPDATE on this row:

```ts
subscribeToGameStatus(gameId, ({ status, white_id, black_id }) => {
  setStatus(status);
  // WaitingForOpponent uses this to flip into <GameClient>.
});
```

`<WaitingForOpponent>` uses this subscription. When `status` flips from `'open'` to `'in_progress'`, it calls `router.refresh()` to re-hydrate as `<GameClient>`. `<GameClient>` itself also subscribes for terminal-status changes to keep board locked correctly.

#### Join open game

1. Viewer hits `/games/<id>` while not a participant. Server renders `<JoinGameForm>`.
2. Click "Join as <empty side>" → Server Action `joinGame({ gameId })` → `join_open_game` RPC.
3. On success → `router.refresh()` → server re-renders → game now `'in_progress'` → `<GameClient>` mounts.
4. On `already_filled` → toast, `router.refresh()`. Page now shows the active game with someone else as the other player; viewer is non-participant → `notFound()`.

#### Create game

1. `/games/new` form: side picker (white / black / random).
2. Submit → Server Action `createGame({ myColor })`:
   - If `myColor === 'random'`, server picks `Math.random() < 0.5 ? 'white' : 'black'`.
   - Call `create_game(resolvedColor)` RPC → returns `gameId`.
   - `redirect(`/games/${gameId}`)`.

### 4.5 UI sketch — sidebar minimal

```
┌──────────────────────────────┬────────────────────┐
│                              │ Black              │
│                              │ alice              │
│                              │                    │
│        <Chessboard />        │   Your turn        │
│                              │                    │
│                              │ White              │
│                              │ bob (you)          │
└──────────────────────────────┴────────────────────┘
```

Sidebar contents (all derivable from state + props):
- Black player block: display_name. Highlighted if it's their turn.
- Turn indicator: "Your turn" / "Opponent's turn" / "Game over: <status>".
- White player block: display_name. Highlighted if it's their turn.
- Last move SAN, small (optional polish).

Board orientation: pass `boardOrientation={myColor === 'b' ? 'black' : 'white'}` to `<Chessboard>`. Black sees board flipped automatically.

Theming: `<Chessboard>` accepts `customDarkSquareStyle` / `customLightSquareStyle`. Wire to existing CSS variables from `domain/theming.md` so future theme swaps cascade.

### 4.6 Auth + authorization summary

| Scenario | Outcome |
|---|---|
| Unauthenticated hits `/games/new` or `/games/<id>` | Redirect to `/login?next=…`. |
| Authed non-participant hits `'open'` game URL | RLS allows SELECT. Renders `<JoinGameForm>`. |
| Authed non-participant hits non-`'open'` game URL | RLS hides row. `notFound()`. Don't leak existence. |
| Creator opens own URL second tab while `'open'` | Server detects viewer = filled side → `<WaitingForOpponent>`. No duplicate-join risk. |
| Self-join (creator clicks join in own game) | RPC raises `already_a_participant`. |
| Move on opponent's turn | Server RPC raises `wrong_turn`. Client catches before network if local validate detects it. |

## 5. Error handling

### 5.1 Error code → user-facing message

All codes already produced by `app/games/[gameId]/actions.ts:makeMove` (phase 4). New errors from phase-5 actions follow the same pattern.

| Code | Message | Side effect |
|---|---|---|
| `validation` | "Invalid move format" | (defensive — chess.js produces valid UCI) |
| `illegal_move` | "Illegal move" | (rare — local validate filters most) |
| `wrong_turn` | "Not your turn" | |
| `game_over` | "Game already over" | Lock board. |
| `concurrency_conflict` | "Position changed — refreshing" | `router.refresh()`. |
| `not_a_participant` | "You're not a player in this game" | |
| `not_active` | "Game is not active" | |
| `game_not_found` | "Game not found" | (no auto-redirect; user can navigate away) |
| `unauthenticated` | "Sign in again" | `router.push('/login?next=…')`. |
| `unknown` | "Something went wrong — try again" | |
| `already_filled` (joinGame) | "Someone else joined first" | `router.refresh()`. |
| `already_a_participant` (joinGame) | "You're already in this game" | `router.refresh()`. |
| `not_open` (joinGame) | "Game is no longer open" | `router.refresh()`. |

### 5.2 Realtime channel failures

Supabase JS auto-reconnects. On `SUBSCRIBED` (initial AND post-reconnect), the subscription helper triggers a `router.refresh()` so any events missed during the disconnect are caught up via canonical `games` row fetch. The ply-guard then drops late-arriving stale events.

`postgres_changes` is **not replay-on-reconnect** — events that fire while a client is disconnected are gone. The router.refresh re-hydrates from the `games` table, which is canonical (atomic with `game_moves` inserts). So missed events do not corrupt state.

### 5.3 Defensive: corrupted FEN

If `fen` is somehow malformed, `chess.js` constructor throws. `<GameClient>` wraps board + state derivation in an error boundary that renders "Game state corrupted — please refresh." Likely unreachable; cheap insurance.

## 6. Testing

### 6.1 Unit tests (Bun)

- `lib/realtime/subscribe.test.ts` — `MoveEventSchema` and `GameStatusUpdateEventSchema` accept valid payloads, reject malformed.
- `lib/schemas/game.test.ts` — `CreateGameInputSchema` and `JoinGameInputSchema` happy + sad paths.

No new tests needed for `lib/chess/engine.ts` (phase 4 covered).

### 6.2 E2E (Playwright)

#### `e2e/multiplayer-untimed.spec.ts` — happy path

Two browser contexts via `loginAs` helper from phase 4.

1. Alice navigates to `/games/new`, selects white, submits → lands on `/games/<id>` showing `<WaitingForOpponent>`.
2. Bob navigates to `/games/<id>` → sees `<JoinGameForm>` → clicks "Join as black".
3. Alice's tab flips automatically (via `games` UPDATE subscription) to `<GameClient>`.
4. Both play fool's mate: 1.f3 e5 2.g4 Qh4#.
5. Assert per move: opposite browser sees the move within 2s.
6. After mate: both browsers show `status: 'black_won'`, board locked, no further drags accepted.

#### `e2e/concurrency-conflict.spec.ts`

1. Alice + Bob in active game.
2. White's turn. Programmatically fire two `makeMove` Server Action calls against the same `expected_ply` via `Promise.all` (one from Alice's session token, one synthetic). Or: have Alice issue two near-simultaneous moves through the same client by patching pending guard.
3. Assert: one returns `ok:true`, the other returns `ok:false code:'concurrency_conflict'`.
4. Loser's UI shows toast and refreshes; final fen matches winner's move.

#### `e2e/join-race.spec.ts`

1. Alice creates open game (white).
2. Two contexts (Bob, Carol) navigate to same URL.
3. Both click "Join as black" via `Promise.all`.
4. Assert: one becomes black; other gets `already_filled` toast and redirects to `notFound()` (because the game is no longer joinable for them).
5. Alice's third tab flips to `<GameClient>` automatically.

### 6.3 Verification commands (per `CLAUDE.md` AI rails)

- `bun run lint`
- `bunx tsc --noEmit`
- `bunx playwright test`
- `supabase db lint`

## 7. Verification gate

Before marking phase 5 done:

1. All unit + e2e tests green locally.
2. `supabase db lint` passes (no new advisors regressed).
3. Two-browser manual smoke: happy path + one concurrency race.
4. CI green on the `feat/phase-5-board-realtime` PR.
5. PR merged to `dev` (linear), then `dev` → `main` PR opens phase-6 prep.

## 8. Risks and open implementation-time questions

These are not design unknowns; they are points the implementer must resolve when reading current docs.

- **react-chessboard major version API**: v3 vs v4 vs v5 differ on promotion handling and `onPieceDrop` signature. Pin the major version, read its docs at install time.
- **`<Chessboard>` SSR**: library is client-only; importing from inside `'use client'` is sufficient. No `dynamic({ ssr: false })` wrapper needed unless hydration warnings appear in dev.
- **Sonner mount point**: `<Toaster>` goes in `app/layout.tsx` once; client toasts call `toast.error(...)` directly.
- **Theming wiring**: pass CSS-var-based custom square styles per `domain/theming.md` so dark mode works.
- **Subagent dispatch tier**: `GameClient` is the highest-judgment task in phase 5 — it carries react-chessboard 4.x API verification, the race-safe `applyMove` reducer, and the 13-code error map. The phase 5 plan flags it as the only Opus + high-effort task; all other tasks dispatch at Sonnet or Haiku. See the dispatch table in `docs/superpowers/plans/2026-05-03-v2-phase-5-board-realtime.md` §"Subagent dispatch guidance".

## 8a. Post-ship additions (2026-05-03)

Items merged to `dev` after the original spec was written, captured here for an at-a-glance picture of what shipped vs what was originally planned:

- **UX polish** — sidebar redesign with team-colored pills + turn arrow, click-to-move, legal-target circles (dot/ring), hover-confirm border on prospective drop square, drag-restrict to own pieces, optimistic fen update with rollback, king-in-check / checkmate square highlight + player-namecard overlay, status pill calls out check / checkmate. Squashed in `eaf38e0` (PR #9).
- **Observer mode** — any authenticated user with the URL can watch a game live (read-only). New migration `20260503124751_add_observer_select_policies.sql` widens RLS on `games` and `game_moves` to authenticated SELECT; writes remain participant-only via RPC checks. `<GameClient>` accepts `myColor: "w" | "b" | null`; null = observer, which disables drag/click and renders an "Observing — <side> to move" status. Same squash commit (`eaf38e0`).

Both addressed deferred / discovered concerns from §3 ("Non-goals") and the manual two-browser smoke. Phase 6 picks up resign / abort / terminal-banner / move-list (per the foundation spec Step L).

## 9. References

- Foundation spec: `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` §6.4 (realtime), §6.5 (repo layout), §7 Step K.
- Phase 4 plan (predecessor): `docs/superpowers/plans/2026-05-02-v2-phase-4-make-move-rpc.md`.
- Realtime + RLS gate procedure: `wiki/notes/realtime-rls-gate-procedure.md`.
- Decision (RPC vs app orchestration): `wiki/notes/decision-rpc-move-append.md`.
- Theming policy: `.claude/memory/domain/theming.md`.
- v1 board postmortem (for what NOT to copy): captured in phase-5 brainstorming session — narrative coupling, ARIA-grid pattern bugs, FLIP race, missing orientation prop, no promotion UI. Phase 5 sidesteps these by adopting `react-chessboard`.
