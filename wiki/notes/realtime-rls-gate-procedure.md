# Realtime + RLS Gate Procedure

**Purpose:** Catch the v1 failure mode where Realtime fires events but RLS denies the SELECT, so subscribers receive empty rows. Run this procedure whenever:

- A new RLS policy on a Realtime-published table is added or changed
- The Realtime publication is altered
- Before merging any change that touches `games` or `game_moves` tables
- Before any production deploy that touches RLS

## Procedure (10 minutes)

1. **Confirm test users.** At least two existing users in `auth.users` + `public.profiles`. A third user (non-participant) is required for the negative test. New project? Sign up via `/sign-up` for each.
2. **Create a shared game.** Insert a `public.games` row with `white_id = USER_A_ID, black_id = USER_B_ID, status = 'in_progress'`. Use Supabase MCP `execute_sql` or Studio. Note the returned `id` (Game A).
3. **Create a non-participant game.** Insert another `public.games` row with `white_id = USER_C_ID, black_id = null, status = 'in_progress'`. Note the `id` (Game B).
4. **Open the diagnostic UI in two separate browser contexts** (e.g. Chrome + Chrome Incognito, or Chrome + Firefox). One logs in as User A, the other as User C.
5. **Positive test (Game A — both should be participants).** Rebind black_id to User C if needed so both browsers are participants. Both browsers: paste Game A id → Subscribe. Status should reach `subscription: SUBSCRIBED` on each. Insert a `game_moves` row for Game A. Both browsers should show the event with `new` fully populated.
6. **Negative test (Game B — only User C is participant).** Both browsers: Stop → paste Game B id → Subscribe again. Insert a `game_moves` row for Game B. User C's browser should show the event with `new` populated. User A's browser should stay at `Events (0)` — silence is correct.
7. Clean up test rows when done (optional — tests are idempotent and the diagnostic page survives across runs).

## Fail modes + diagnoses

| Symptom | Diagnosis | Fix |
|---|---|---|
| No event arrives in either browser | Publication misconfigured | `alter publication supabase_realtime add table public.<table>;` |
| Event arrives, `new` is empty `{}` or `null` | RLS denies SELECT for the subscriber | Fix the RLS SELECT policy to allow the subscriber's role |
| Subscription status stays `CHANNEL_ERROR` or never reaches `SUBSCRIBED` | Auth or WebSocket issue | Check browser DevTools Network tab for `realtime/v1/websocket`; verify env vars `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set; verify session cookie present |
| Non-participant subscriber receives event with row data | RLS too permissive (or missing entirely) | Tighten the SELECT policy to require participant relationship |
| Participant subscribed before insert sees nothing | Channel not actually subscribed despite UI; or stale dev server | Hard-refresh browser, Stop → Subscribe; restart dev server if hot-reload missed the Client Component |

## Why this exists

v1 had Realtime publications and RLS policies. The publications fired events. But RLS policies denied the SELECT that Realtime needs to read the row before delivering it to the subscriber. Net: events arrived but rows came back as `null` to the subscriber, looking like silence. v2 caught this BEFORE writing board UI, because debugging silent Realtime is much harder once UI is in the picture.

## When to re-run

- After any RLS migration on `games` or `game_moves`
- After any Realtime publication change
- Before any production deploy that touches RLS
- After upgrading `@supabase/supabase-js`, `@supabase/ssr`, or Supabase server runtime

## Procedure verified

**2026-05-02 (Phase 3 ship):** Both positive and negative tests passed against v2 Supabase project (`pgxqlyiyaehppkfeceuc`). Game A insert visible to both white and black participants with full row data; Game B insert silent for non-participant Taylor while visible to participant alt+2.

## See also

- Phase 3 plan: `docs/superpowers/plans/2026-05-02-v2-phase-3-schema-rls-realtime-gate.md`
- Diagnostic UI: `app/diagnostics/realtime/` — kept in-repo for future regression hunting
- [[mocs/architecture]]
- [[mocs/decisions]]
