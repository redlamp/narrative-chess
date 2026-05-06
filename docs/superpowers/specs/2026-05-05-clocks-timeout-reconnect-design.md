# M1.5++ — Clocks, Timeout, Reconnect (Design)

**Date:** 2026-05-05
**Status:** Draft, pending review
**Milestone:** M1.5++

## 1. Goal

Add time controls to multiplayer chess. Two players agree on a time format at game-create, both clocks tick when it's their turn, running out of time ends the game with a `timeout` termination (or `abort` if no moves played yet). Cover both **live** (Fischer-style total + increment) and **correspondence** (per-move deadline) game shapes from one schema.

## 2. Locked decisions (from brainstorm)

| # | Decision |
|---|---|
| Q1 | Time format = configurable per game |
| Q2 | Scope = live + correspondence (no push notifications) |
| Q3 | Lag policy = chess.com 200ms credit per move |
| Q4 | Reconnect = strict, clock keeps running |
| Q5 | Presets = 5 (Untimed, 5+0, 10+0, 15+10, 1 day/move) |
| Q6 | Cron sweep = daily, lazy detection primary |
| Q7 | First-move timeout = abort |
| Q8 | Game-create flow = creator picks at create-time |

**Defaults (no explicit user vote):** Fischer post-move increment, chess.com-style clock UI (above + below board), correspondence display in days/hours, no pre-moves, no presence/online indicator (deferred to follow-up), no custom-time-control builder (deferred).

## 3. Architecture

Server-authoritative clocks. DB stores `turn_started_at` + per-side remaining ms; client interpolates display locally; server enforces deadlines via `make_move` lazy check + `claim_timeout` RPC + daily Vercel Cron sweep.

```
┌─────────────────┐                ┌─────────────────┐
│  Player A UI    │                │  Player B UI    │
│  (Clock × 2)    │ ←───────────→  │  (Clock × 2)    │
│  local interp   │   Realtime     │  local interp   │
└────────┬────────┘                └────────┬────────┘
         │                                  │
         │ make_move /                      │ claim_timeout (auto)
         │ claim_timeout                    │
         ↓                                  ↓
   ┌─────────────────────────────────────────────┐
   │      Postgres (games row + RPCs)            │
   │  - lazy timeout check inside make_move      │
   │  - claim_timeout for waiting-side claim     │
   │  - end_timeout for cron sweep (service-role)│
   └────────────────────┬────────────────────────┘
                        │
                        │ daily 04:00 UTC
                        ↓
              ┌──────────────────────┐
              │  /api/cron/          │
              │  timeout-sweep       │
              │  (Vercel Cron)       │
              └──────────────────────┘
```

## 4. Schema delta

New migration `<timestamp>_add_clocks_to_games.sql`:

```sql
alter table public.games
  add column time_control_type text
    check (time_control_type in ('live', 'correspondence')),
  add column time_initial_seconds int,
  add column time_increment_seconds int default 0,
  add column time_per_move_seconds int,
  add column white_remaining_ms bigint,
  add column black_remaining_ms bigint,
  add column turn_started_at timestamptz;

alter table public.games
  add constraint games_time_control_shape check (
    (time_control_type = 'live'
       and time_initial_seconds is not null
       and time_per_move_seconds is null)
    or (time_control_type = 'correspondence'
       and time_per_move_seconds is not null
       and time_initial_seconds is null)
    or (time_control_type is null) -- untimed (legacy or new)
  );

-- Drop existing termination_reason check constraint by introspected name;
-- Postgres auto-named it on the original ADD COLUMN ... CHECK in
-- 20260503132654_resign_and_abort_rpcs.sql. Migration-write time will
-- resolve the actual name via pg_constraint and emit the correct DROP.
do $$
declare c_name text;
begin
  select conname into c_name
  from pg_constraint
  where conrelid = 'public.games'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%termination_reason%';
  if c_name is not null then
    execute format('alter table public.games drop constraint %I', c_name);
  end if;
end $$;

alter table public.games add constraint games_termination_reason_check
  check (termination_reason in (
    'checkmate','stalemate','threefold','fifty_move','insufficient',
    'resignation','abort','timeout'
  ));
```

**Notes:**

- NULL `time_control_type` = untimed (legacy M1 rows + new untimed preset). RPCs skip clock math when NULL.
- `turn_started_at` is the wall-clock anchor for both server elapsed math and client interpolation.
- `white_remaining_ms` / `black_remaining_ms` initial values seeded by `create_game`:
  - live: `time_initial_seconds * 1000`
  - correspondence: `time_per_move_seconds * 1000`
  - untimed: NULL
- Realtime publication unchanged — new columns ride along on existing `games` row updates. No new RLS policies needed. Re-run RLS gate procedure as a smoke test that participants still receive row updates with the new columns and observers stay gated as before.

## 5. RPC changes

### 5.1 `create_game` (extended)

```sql
create or replace function public.create_game(
  p_my_color text,
  p_time_control_type text default null,
  p_time_initial_seconds int default null,
  p_time_increment_seconds int default 0,
  p_time_per_move_seconds int default null
) returns uuid ...
```

Validates shape (matches table constraint); seeds `white_remaining_ms` + `black_remaining_ms`; leaves `turn_started_at` NULL until `join_open_game`.

### 5.2 `join_open_game` (extended)

When game flips to `in_progress`, set `turn_started_at = now()`. White's clock starts ticking immediately.

### 5.3 `make_move` (extended)

Before existing validation, **lazy timeout check** (only if `time_control_type IS NOT NULL`):

```
v_active_remaining := case current_turn when 'w' then white_remaining_ms else black_remaining_ms end
v_elapsed_ms := greatest(0, extract(epoch from (now() - turn_started_at)) * 1000 - 200)  -- 200ms lag credit

-- For correspondence, white_remaining_ms / black_remaining_ms are reset to
-- time_per_move_seconds * 1000 at the start of each turn, so
-- v_active_remaining IS the per-move deadline. No separate ceiling needed.
if v_elapsed_ms > v_active_remaining then
  if g.ply = 0 then
    -- first-move timeout = abort (Q7)
    update games set status='aborted', termination_reason='abort', ended_at=now()
  else
    -- timeout-loss for active side
    update games set
      status = case current_turn when 'w' then 'black_won' else 'white_won' end,
      termination_reason = 'timeout',
      ended_at = now()
  end if
  return ended-row
end if
```

If not expired, after move applies + turn flips:

- Deduct `v_elapsed_ms` from active side's remaining
- Live: add `time_increment_seconds * 1000` to active side's remaining (post-move increment)
- Correspondence: reset newly-active side's remaining to `time_per_move_seconds * 1000` (per-move deadline)
- Set `turn_started_at = now()`

### 5.4 `claim_timeout(p_game_id)` (new)

Caller is the **waiting** side (or any observer). Server validates active-side deadline expired (same math as 5.3). On success:

- ply=0 → abort
- else → timeout-loss for active side, opponent wins, `termination_reason='timeout'`

Idempotent: if `status ≠ 'in_progress'`, no-op success. If deadline not yet expired, raise `not_yet_expired`.

### 5.5 `end_timeout(p_game_id)` (new, service-role)

Same logic as 5.4 but security definer + no caller validation. Called by cron route. Re-validates deadline expired (defense in depth) before ending.

### 5.6 Existing RPCs unchanged

`resign`, `abort_game` unchanged. (Q7 first-move timeout maps to abort via in-line logic in 5.3 / 5.4 / 5.5, not via calling `abort_game`.)

## 6. UI components

### 6.1 `TimeControlPicker.tsx` (new, in `app/games/new/`)

5 radio options:

| Preset | type | initial | increment | per-move |
|---|---|---|---|---|
| Untimed | NULL | — | — | — |
| 5 min | live | 300 | 0 | — |
| 10 min | live | 600 | 0 | — |
| 15 + 10 | live | 900 | 10 | — |
| 1 day/move | correspondence | — | — | 86400 |

Default = "10 min". Wired into `NewGameForm.tsx`; values pass to extended `create_game` server action.

### 6.2 `Clock.tsx` (new, used by `GameClient.tsx`)

Props: `side: 'white'|'black'`, `remainingMs: number|null`, `turnStartedAt: string|null`, `isActive: boolean`, `timeControlType: 'live'|'correspondence'|null`.

**Local interpolation** (mirrors server math in 5.3 — 200ms lag credit added so client display matches what server will deduct on next move):

```ts
const displayedMs = isActive && turnStartedAt
  ? Math.max(0, remainingMs - (Date.now() - new Date(turnStartedAt).getTime()) + 200)
  : remainingMs;
```

Re-snaps via `useEffect` deps on the props (server pushes new row → new props → re-snap).

**Tick rate:**

- Live, displayed > 10000 ms: 1000ms
- Live, displayed ≤ 10000 ms: 100ms
- Correspondence: 60000ms
- Untimed (`timeControlType === null`): no tick, render nothing

**Format:**

- Live: `MM:SS`, switching to `M:SS.t` (tenths) when `displayedMs ≤ 10000`
- Correspondence: `Nd Hh` when `displayedMs > 3600000`, else `MM:SS`

**Active highlight:** subtle ring/glow + pulse when `isActive`. Pulse intensifies when `displayedMs ≤ 30000` (low-time warning). Inactive: muted.

### 6.3 Auto-claim hook (in `GameClient.tsx`)

When the **opponent's** displayedMs hits 0 (interpolated locally):

1. 1-second debounce (avoid race with server-side lazy detection)
2. Fire `claim_timeout` server action
3. On `not_yet_expired` (server-side clock skew), retry once after 500ms
4. On `not_active` (game already ended via lazy or another claim), no-op

When **own** displayedMs hits 0:

- Lock the move-input UI (drag + click handlers no-op)
- Show subtle banner: "Time's up — waiting for opponent to claim"

### 6.4 Placement (within `GameClient.tsx`)

```
[opponent clock]   [opponent name]
         [board]
[your clock]       [your name]
```

White/black perspective mirrors existing flip logic.

### 6.5 Updated existing components

- `NewGameForm.tsx` — embed `TimeControlPicker`
- `GameClient.tsx` — render two `Clock` instances + auto-claim hook
- `JoinGameForm.tsx` — display time control on join screen so joiner can decline
- `app/games/page.tsx` — small time-control badge per game row in directory

## 7. Cron route

### 7.1 `app/api/cron/timeout-sweep/route.ts` (new)

Vercel cron, runs daily at 04:00 UTC. Catches games where neither player nor observer touched the game after deadline expired.

**Auth:** `Authorization: Bearer ${process.env.CRON_SECRET}`. Vercel auto-injects on cron triggers.

**Logic:**

```ts
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: candidates } = await supabase
    .from('games')
    .select('id, current_turn, ply, turn_started_at, white_remaining_ms, black_remaining_ms, time_control_type, time_per_move_seconds')
    .eq('status', 'in_progress')
    .not('time_control_type', 'is', null);

  let ended = 0;
  for (const g of candidates ?? []) {
    if (await isExpired(g)) {
      await supabase.rpc('end_timeout', { p_game_id: g.id });
      ended++;
    }
  }

  return Response.json({ ended, candidates: candidates?.length ?? 0 });
}
```

`isExpired` uses the same elapsed-vs-deadline math as RPCs (consistency).

### 7.2 `vercel.ts` cron config

```ts
crons: [
  { path: '/api/cron/timeout-sweep', schedule: '0 4 * * *' },
],
```

### 7.3 Env

`CRON_SECRET` — random 32+ char string. Must be set in Vercel project envs (Production + Preview-dev). Add to `.env.example`.

## 8. Data flow

### 8.1 Move flow (no timeout)

Player A drags → Server Action validates with chess.js → `make_move` RPC (lazy timeout check passes, deduct elapsed, add increment, flip turn, set `turn_started_at=now()`) → Realtime broadcast → both clients re-snap clocks.

### 8.2 Timeout via active side's late move

Player A's clock at 0, A drags piece → `make_move` lazy check: elapsed > remaining → ends game with timeout (or abort if ply=0) → row update broadcast → A's UI shows "you timed out".

### 8.3 Timeout via opponent claim

Player B's `Clock` interpolates A's countdown to 0 → 1s debounce → `claim_timeout` server action → RPC re-validates expired → ends game, B wins → row update broadcast.

### 8.4 Timeout via cron (both sides offline)

04:00 UTC → Vercel triggers `/api/cron/timeout-sweep` → query in_progress games with time_control_type → for each expired: `end_timeout` RPC → row update broadcast (no listeners, just DB cleanup).

### 8.5 Reconnect (strict, Q4=1)

Player closes tab + returns 30s later: page mounts, GameClient subscribes, initial fetch returns latest games row, Clock interpolates (deducts the 30s offline). If clock now ≤ 0 + own turn: locked, wait for opponent claim or sweep. If opponent's clock now ≤ 0: auto-claim fires immediately.

## 9. Error handling

| Scenario | Behavior |
|---|---|
| Move arrives at server with elapsed > remaining | RPC ends game with timeout (or abort if ply=0); returns end-state row |
| Two clients race claim_timeout | Idempotent — second call sees `status≠'in_progress'`, no-op succeeds |
| Cron + claim_timeout race | RPC re-validates deadline + checks status; second writer no-ops |
| Clock skew between client + server | Server-authoritative; 200ms lag credit absorbs ~200ms skew |
| Player exits + returns past deadline | Reconnect interpolates negative remaining, locks UI, waits for end-state |
| Negative remaining stored | Clamp to 0 in display + RPC math; only ever transient |
| Joiner declines time control | Backs out of join screen (no-op, game stays open). No negotiate path |
| Untimed game (legacy or new) | All clock columns NULL, RPC skips clock math, cron filters via `time_control_type IS NOT NULL` |
| `claim_timeout` called with deadline not actually expired | RPC raises `not_yet_expired`; client logs, retries once, then ignores |
| Move attempt while own clock ≤ 0 | UI locks pre-submit; if user bypasses, server rejects via lazy check |
| First move never made (both sides idle) | Lazy never triggers (no move attempt); cron daily picks up; ply=0 → abort |
| `turn_started_at` NULL on `in_progress` row | Should never happen; defensive: RPCs treat NULL as "no clock active" + skip math |

### Error codes

- `timed_out` — RPC enforced timeout end (replaces normal move)
- `not_yet_expired` — claim_timeout called too early
- existing: `unauthenticated`, `not_a_participant`, `wrong_turn`, `concurrency_conflict`, `not_active`

### Server Action surface

`makeMove`, `claimTimeout`, `createGame` (extended) return discriminated union: `{ ok: true, game } | { ok: false, code, detail? }`. UI maps codes to toast/banner.

## 10. Testing

### 10.1 Unit (vitest, `lib/chess/clock.ts`)

- Clock math: `computeRemaining(remainingMs, turnStartedAt, now, lagCreditMs)`
- Increment math: post-move remaining = before - elapsed + increment_ms (live)
- Correspondence reset: post-move remaining = time_per_move_seconds*1000
- Format: `formatLive(ms)` boundary at 10s
- Format: `formatCorrespondence(ms)` boundary at 1h
- First-move timeout = abort, post-move-1 = timeout-loss

### 10.2 Integration (Supabase, against test project)

- `create_game` with each preset shape persists correct columns
- `create_game` invalid shape (live + per_move set) raises constraint violation
- `join_open_game` sets `turn_started_at = now()`
- `make_move` deducts elapsed + adds increment correctly
- `make_move` deadline expired ends game with timeout (or abort if ply=0)
- `claim_timeout` deadline live raises `not_yet_expired`
- `claim_timeout` deadline expired ends game, opponent wins
- `claim_timeout` race: second caller no-ops
- `end_timeout` cron path same coverage

### 10.3 E2E (Playwright, two-browser)

- 5+0 game, both players move, increments accrue correctly
- 15+10 game, multiple moves, post-move increment lands
- 5+0 game, white runs clock to 0, black auto-claims, end-state banner correct
- 1 day/move correspondence, white moves, black countdown shows day/hour, black moves, white resets to 1 day
- Untimed game still works end-to-end (no clocks rendered, no math runs)
- TimeControlPicker on game-create persists + displays on join screen
- Player closes tab + reopens past deadline → end-state visible / locked board

### 10.4 Manual smoke

- Cron sweep: trigger via `curl /api/cron/timeout-sweep -H "Authorization: Bearer $CRON_SECRET"` against preview; verify abandoned game ends within sweep window
- Visual: clock animations + active-side highlight + low-time pulse <10s

### 10.5 Realtime + RLS gate

Schema delta adds columns to existing `games` table — already in publication. Re-run gate procedure (`wiki/notes/realtime-rls-gate-procedure.md`) to confirm participants still see their rows + observers still gated correctly.

## 11. Out of scope (deferred follow-ups)

- Push notifications for correspondence-game turns (deferred from Q2)
- Presence/online indicator (deferred from Approach 2)
- Custom time-control builder UI (deferred from preset Q5)
- Pre-move support
- Lag compensation beyond fixed 200ms credit
- Heartbeat / stale-tab detection
- Polish A (draw-by-agreement) — separate task; will plug into the same timeout/end-state code paths
- Polish B (move-list stepper) — separate task; can show per-move clock times once M1.5++ ships
- Polish C (mobile/touch) — separate task

## 12. Plan handoff

After this spec is approved, the writing-plans skill produces a step-by-step implementation plan at `docs/superpowers/plans/2026-05-05-m1-5-pp-clocks-timeout-reconnect.md`. Plan likely splits into multiple feat-branches/PRs (schema + RPCs first, UI second, cron + tests third).
