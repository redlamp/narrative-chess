# V2 Phase 6 — Game End States + Resign / Abort Design

**Date:** 2026-05-03
**Status:** Draft, pending implementation
**Spec ref:** `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` Step L (game end states + resign) and Step M (e2e + M1 ship).
**Predecessor phases:** 1–5 shipped.

## 1. Context

Phase 5 closed the loop on real-time multiplayer chess: two users sit down, play, and every legal move propagates to the other side via realtime. The chess engine already detects checkmate / stalemate / threefold / fifty-move / insufficient material and the make_move RPC sets `games.status` to the right terminal value when those land.

What's missing for an M1-shippable product:

- **No way to end a game without playing it out.** A user who's clearly losing has to either play to mate or close their tab. There's no resign button.
- **No "I clicked the wrong color, never mind" exit before move 1.** A creator who picked the wrong side or paired with the wrong opponent has no abort.
- **Terminal states render only as a faint sidebar pill.** When checkmate lands the winner sees "Black wins" in a 12px font and the board locks; there's no banner, no winner callout, no path to start another game.

Phase 6 adds the three explicit user-driven endings (resign, abort, draw-by-agreement is deferred), the UI to make them invokable, and the terminal-state banner so a finished game has a clean, communicative end. After phase 6, M1 ships `dev` → `main`.

## 2. Goals

- Either player can resign mid-game; the game flips to the opposite-color win and locks.
- Either player can abort before move 1; the game flips to `aborted` and locks.
- Terminal states (checkmate / stalemate / draw / resign / abort) render a clear inline banner with the outcome + a "Start new game" CTA.
- Existing realtime channel pushes status flips so both players (and any observers) see the ending without refresh.
- E2E coverage: resign flow, abort flow.
- All file invariants from `CLAUDE.md` hold (chess.js stays in `lib/chess/engine.ts`, DB writes via Server Actions / RPCs, RLS in same migration as the table or RPC it guards).

## 3. Non-goals (deferred to phase 7 or beyond)

- **Draw-by-agreement** (offer / accept / decline). Real chess UX requires a propose / response flow with an offer-status field; not needed for M1.
- **Move list panel** with click-to-rewind. Nice-to-have, defer to a dedicated UX phase.
- **Game lobby** (`app/games/page.tsx` listing your active games + open challenges). URL-share covers M1; lobby waits for M1.5.
- **Rematch** (one-click "play again, swap colors"). Flows from "Start new game" CTA going to `/games/new` for now.
- **Time controls / clocks.** M1.5 work per the foundation spec.
- **Resign / abort via realtime broadcast** (typing indicators, etc.). Status flip via `games` UPDATE subscription is enough.

## 4. Architecture

### 4.1 Component changes

```
app/games/[gameId]/
  GameClient.tsx        -- ADD: GameActions (resign / abort buttons + confirm),
                                TerminalBanner (winner/reason + Start new game CTA),
                                disable input + clear selection when terminal.
  actions.ts            -- ADD: resign(input), abortGame(input).
  GameActions.tsx       -- NEW: client component, the actions menu.
  TerminalBanner.tsx    -- NEW: client component, the inline result banner.

supabase/migrations/
  <ts>_resign_and_abort_rpcs.sql  -- NEW: public.resign + public.abort_game
                                          (SECURITY DEFINER, participant-checked).
```

### 4.2 RPCs

Two new RPCs, both `SECURITY DEFINER`, both `grant execute … to authenticated`. Mirror the phase-4 / phase-5 RPC pattern: re-check `auth.uid()` and authorization explicitly because RLS does not gate function calls.

#### `resign(p_game_id uuid) returns public.games`

Behavior:
1. Reject if `auth.uid() is null`.
2. Lock target row: `select … for update`.
3. Reject `game_not_found` if missing.
4. Reject `not_active` if status ≠ `'in_progress'`.
5. Reject `not_a_participant` if caller is not in `white_id` / `black_id`.
6. Determine winner: opposite color of caller.
7. Update row:
   - `status` → `'white_won'` if caller is black, `'black_won'` if caller is white.
   - `ended_at = now()`.
8. Return updated row.

The make_move RPC's existing terminal-status logic does not need to change — make_move handles checkmate / draw transitions; resign / abort run separately.

#### `abort_game(p_game_id uuid) returns public.games`

Behavior:
1. Reject if `auth.uid() is null`.
2. Lock target row: `select … for update`.
3. Reject `game_not_found` if missing.
4. Reject `not_a_participant` if caller is not in `white_id` / `black_id`.
5. Reject `not_abortable` if `ply > 0` OR status is already terminal. (Ply 0 = no moves played; ply 1+ means the game has started and abort is no longer available.)
6. Update row:
   - `status` → `'aborted'`.
   - `ended_at = now()`.
7. Return updated row.

Both RPCs raise `P0001` errcodes consistent with the existing pattern.

### 4.3 Server Actions

Both Server Actions live in `app/games/[gameId]/actions.ts` alongside the existing `makeMove` and `joinGame`. They follow the established outcome-object pattern:

```ts
export type ResignErrorCode =
  | "validation"
  | "unauthenticated"
  | "game_not_found"
  | "not_active"
  | "not_a_participant"
  | "unknown";

export type ResignOutcome =
  | { ok: true }
  | { ok: false; code: ResignErrorCode; message: string };

export async function resign(input: unknown): Promise<ResignOutcome> { ... }

export type AbortErrorCode =
  | "validation"
  | "unauthenticated"
  | "game_not_found"
  | "not_a_participant"
  | "not_abortable"
  | "unknown";

export type AbortOutcome =
  | { ok: true }
  | { ok: false; code: AbortErrorCode; message: string };

export async function abortGame(input: unknown): Promise<AbortOutcome> { ... }
```

Input validation via small Zod schemas (`ResignInputSchema`, `AbortInputSchema`) added to `lib/schemas/game.ts`.

### 4.4 UI

**`<GameActions>`** (new client component, mounted in `GameClient`'s sidebar):

- Renders an inline "Game" affordance — a small button group with **Resign** + **Abort** options. (Could be a dropdown menu, but a flat row keeps the affordance discoverable.)
- **Abort button**: visible only when `state.ply === 0` AND `state.status === 'in_progress'` AND viewer is participant.
- **Resign button**: visible when `state.ply >= 1` AND `state.status === 'in_progress'` AND viewer is participant.
- Both gated by `!isObserver` — observers never see the actions panel.
- Click triggers a confirmation dialog (shadcn `<AlertDialog>` if available, else a simple modal): "Resign? Your opponent wins." or "Abort? The game ends with no result."
- Confirm → fires Server Action. Toast on error per the standard error-code map. Success → no toast (banner takes over).

**`<TerminalBanner>`** (new client component, conditionally rendered above the board):

- Renders when `state.status` is one of `'white_won' | 'black_won' | 'draw' | 'aborted'`.
- Content: large title + subtitle + CTA.
  - White wins by checkmate → title "White wins", subtitle "By checkmate".
  - Black wins by resignation → title "Black wins", subtitle "By resignation".
  - Draw by stalemate / threefold / 50-move / insufficient → title "Draw", subtitle one of the four.
  - Aborted → title "Game aborted", subtitle "Started before the first move was made".
- "Start new game" button → `router.push('/games/new')`.
- Observer message: replaces "Start new game" with a return-to-overview link if a lobby exists later (M1.5).

The banner does NOT block the board — the user can still inspect the final position. It overlays the top of the board area (sticky pill on top of the board container).

The existing **status pill** in the sidebar continues to render the terminal status as a quick read; the banner is the primary callout.

### 4.5 Distinguishing checkmate from resignation in the banner

The `games` table currently has `status` (`'white_won' | 'black_won' | 'draw' | 'aborted'`) but no `termination_reason`. Without that, the UI can't tell "white won by checkmate" from "white won by resignation".

Two approaches:

**A. Add a `termination_reason` column** (`'checkmate' | 'stalemate' | 'threefold' | 'fifty_move' | 'insufficient' | 'resignation' | 'abort'`) populated by the relevant RPC. Client reads + renders.

**B. Derive at render time** by walking the final fen + last move:
- Last fen has chess.js `isCheckmate()` true → checkmate.
- `isStalemate()` → stalemate.
- `isThreefoldRepetition()` → threefold.
- `isInsufficientMaterial()` → insufficient.
- 50-move → check halfmove clock in fen.
- Otherwise it must be resignation (status ≠ 'in_progress' but no chess-engine terminal applies).

Option B keeps the schema unchanged but is fragile (requires correct chess.js detection on a possibly-stale local fen). Option A is one column + a small set of update lines in three RPCs.

**Decision: Option A.** Add `games.termination_reason text` (nullable, default null), populated by `make_move` (existing) + the two new RPCs. UI reads from the games row.

### 4.6 GameClient state additions

`GameClient` already tracks `status`. Phase 6 reads `termination_reason` (new column) too. Both are kept in sync by the existing `applyMoveLocal` (move events) + `applyStatusLocal` (status updates) — extend the latter to carry the reason.

```ts
type State = {
  fen: string;
  ply: number;
  status: GameStatus;
  terminationReason: TerminationReason | null;  // NEW
  pending: boolean;
};
```

`GameStatusUpdateEventSchema` (in `lib/schemas/game.ts`) extends to include `termination_reason: TerminationReason | null` on the realtime payload. Subscribe handler passes it through.

Server-component hydration (`app/games/[gameId]/page.tsx`) extends its select to include `termination_reason` and passes it as `initialTerminationReason` prop.

### 4.7 Realtime considerations

Both new RPCs flip `games.status`. The existing `subscribeToGameStatus` channel already listens for `games` UPDATE events on the row, so resign / abort propagate to all subscribers (both players + observers) without any new channel work. The handler updates state via `applyStatusLocal`, the banner re-renders.

The existing `applyStatusLocal` only carries the new status; phase 6 extends it to also carry the new termination reason so the banner has all the data.

### 4.8 Auth + authorization summary

| Scenario | Outcome |
|---|---|
| Participant clicks Resign while game is in progress | RPC accepts; status → opposite-color win + termination_reason='resignation'. |
| Participant clicks Abort with ply=0 | RPC accepts; status → aborted + termination_reason='abort'. |
| Participant clicks Abort with ply ≥ 1 | RPC rejects `not_abortable`. UI hides the button at ply 1+, but the server check is the authority. |
| Non-participant attempts resign / abort via direct RPC call | RPC rejects `not_a_participant`. |
| Observer in the UI | Sees neither button (gated by `!isObserver`); has no path to call the RPC. |
| Resign / abort on a terminal game | RPC rejects `not_active` (resign) or `not_abortable` (abort). |

## 5. Error handling

### 5.1 Resign error map

| Code | Toast |
|---|---|
| `validation` | "Invalid request" |
| `unauthenticated` | "Sign in again" + redirect |
| `game_not_found` | "Game not found" |
| `not_active` | "Game is not active" |
| `not_a_participant` | "You're not a player in this game" |
| `unknown` | "Something went wrong — try again" |

### 5.2 Abort error map

| Code | Toast |
|---|---|
| `validation` | "Invalid request" |
| `unauthenticated` | "Sign in again" + redirect |
| `game_not_found` | "Game not found" |
| `not_a_participant` | "You're not a player in this game" |
| `not_abortable` | "Game has already started" + `router.refresh()` |
| `unknown` | "Something went wrong — try again" |

## 6. Testing

### 6.1 Unit tests (Bun)

- `lib/schemas/game.test.ts` — extend with cases for the new `ResignInputSchema` + `AbortInputSchema` + extended `GameStatusUpdateEventSchema` (with `termination_reason`).

No new chess-engine tests needed — phase 4/5 covered terminal-status detection.

### 6.2 E2E (Playwright)

#### `e2e/resign.spec.ts` (new)

1. Set up an in-progress game (admin client) with Alice (white) and Bob (black), ply ≥ 1.
2. Alice's user client calls `resign(p_game_id)`.
3. Assert: RPC returns ok; `games.status = 'black_won'`, `games.termination_reason = 'resignation'`, `games.ended_at` not null.
4. Bob's authenticated session subscribes to the game's status channel and receives the UPDATE within 5s.

#### `e2e/abort.spec.ts` (new)

1. Set up an open game with Alice (white) only; Bob joins; status flips to `'in_progress'` at ply=0.
2. Alice calls `abort_game(p_game_id)` while ply=0.
3. Assert: RPC returns ok; `games.status = 'aborted'`, `games.termination_reason = 'abort'`.
4. Set up a second game with ply=1 (one move played).
5. Alice calls `abort_game(p_game_id)` — RPC rejects `not_abortable`.

#### Existing e2e

- `multiplayer-untimed.spec.ts` — extends with banner assertion: after fool's mate, the banner element is visible with "Black wins" + "By checkmate".

### 6.3 Verification commands

- `bun run lint`
- `bunx tsc --noEmit`
- `bun test`
- `bunx playwright test`
- `supabase db lint`

## 7. Verification gate

Before marking phase 6 done:

1. All unit + e2e tests green locally.
2. `supabase db lint` passes.
3. Two-browser manual smoke:
   - Resign mid-game from white side; black sees banner + locked board.
   - Abort before move 1; both sides see "Game aborted".
   - Try abort after move 1; button is hidden + RPC rejects on direct call.
4. CI green on the `feat/phase-6-game-end-states` PR.
5. PR merged to `dev`.

## 8. Risks and open implementation-time questions

- **shadcn AlertDialog availability.** If not installed, do `bunx shadcn@latest add alert-dialog` as part of Task 2. Keep the dialog import + render in `<GameActions>` consistent with the existing button / label imports.
- **Termination-reason values for existing in-flight games.** Migration needs to leave existing rows' `termination_reason = null`. Make_move RPC needs an UPDATE to populate it on terminal moves going forward. We accept that historical (pre-phase-6) terminal games show "(reason unknown)" in the banner. Phase 6 implementation includes a small backfill of the existing two test games where applicable, or the banner falls back to the status alone.
- **`<TerminalBanner>` z-index / positioning.** Banner overlays the top of the board container; needs to not eat clicks on board for inspection. Implementation uses `pointer-events-none` on the banner with `pointer-events-auto` on its CTA.

## 9. References

- Foundation spec: `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` Step L (game end states + resign), Step M (e2e + M1 ship), Step N (privatize v1).
- Phase 5 design (predecessor): `docs/superpowers/specs/2026-05-03-v2-phase-5-board-realtime-design.md`.
- Phase 5 followups: `wiki/notes/phase-5-followups.md`.
- Phase 4 plan (RPC pattern reference): `docs/superpowers/plans/2026-05-02-v2-phase-4-make-move-rpc.md`.
