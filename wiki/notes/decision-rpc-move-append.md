# Decision — Move Append via Postgres RPC, Not App Orchestration

**Date:** 2026-05-02
**Status:** Adopted

## Context

When a player makes a move, the server must do three things atomically:

1. INSERT a row into `game_moves`
2. UPDATE `games.current_fen`, `current_turn`, `ply`, possibly `status` (terminal states)
3. Reject if another player already advanced `ply`

`docs/V2_PLAN.md` §6.3 said *"In one transaction: INSERT into `game_moves`, UPDATE `games`..."* — but Next.js Server Actions cannot wrap multiple `supabase-js` calls into a single Postgres transaction. Each `.from(...).insert(...)` and `.from(...).update(...)` is an independent HTTP request.

## Options considered

1. App-level orchestration: two `supabase-js` calls inside a Server Action. Hope nothing fails between them.
2. **Postgres RPC `make_move(game_id, uci, expected_ply)` with `SECURITY DEFINER`** (chosen)
3. Edge Function (Deno) wrapping the same logic

## Choice

A Postgres function `public.make_move(p_game_id uuid, p_uci text, p_expected_ply int)` runs the validation + insert + update + terminal-state detection atomically inside a single DB transaction. The Server Action calls `supabase.rpc('make_move', ...)`.

```sql
create function public.make_move(p_game_id uuid, p_uci text, p_expected_ply int)
returns games language plpgsql security definer set search_path = public as $$ ... $$;
revoke all on function public.make_move from public;
grant execute on function public.make_move to authenticated;
```

Optimistic concurrency: if `games.ply <> p_expected_ply` at lock acquisition time, raise `concurrency_conflict`. Client retries with refreshed state.

## Why

- A function = one transaction = atomic. No half-write states.
- `SECURITY DEFINER` lets the RPC update under a privileged role while RLS keeps direct writes locked down to participants. Defense in depth.
- `expected_ply` check protects against:
  - Two-tab racing (same player double-clicks)
  - Replay attacks (old request fired twice)
  - Genuinely concurrent inserts from two clients
- v1 actually got this pattern right (`add_multiplayer_move_append_flow` migration) — v2 carries the structural insight forward even though the v1 implementation around it failed.

## Trade-offs

- Move legality validation (full chess rules: en passant, castling, etc.) is non-trivial in plpgsql. M1 takes a hybrid:
  - Server Action validates with chess.js (JS) before calling the RPC
  - RPC trusts validation but enforces ply + turn consistency at DB level
- Trust boundary documented in CLAUDE.md so future Claude doesn't mistakenly add chess rules to plpgsql.

## Risks / follow-ups

- If `chess.js` validation drifts from what the DB allows, server can persist a "legal-per-JS" but corrupt-per-DB-state move. Mitigation: unit-test chess.js wrapper exhaustively; expand RPC turn/ply checks if needed.
- `SECURITY DEFINER` functions in `public` schema = security risk if function logic has injection or auth-bypass bugs. Mitigation: function takes only typed parameters, never raw SQL; reject on `auth.uid()` mismatch with caller.
- M1.5 clocks will need a separate RPC `claim_timeout(game_id)` running on Vercel Cron. Same pattern.

## See also

- [[mocs/decisions]]
- [[mocs/architecture]]
- `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` §6.3, §7 Step J
- Supabase docs on `SECURITY DEFINER`: https://supabase.com/docs/guides/database/functions
