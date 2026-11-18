---
tags:
  - domain/auth
  - domain/supabase
  - domain/security
  - status/adopted
  - scope/m1
---

# Decision — Role Storage: Text Column + has_role() Helper

**Date:** 2026-05-12
**Status:** Adopted

## Context

Project shipped through M1.5++ with no role system at all — every authenticated user is a "creator-or-participant-or-observer" of games, scoped per-game. No admin tier. No moderation surface. No way to gate destructive operations.

About to invite outside testers, which requires:

- An admin tier so cleanup tooling has somewhere to live
- A tag for e2e/Playwright fixture accounts so they can be nuked separately from real testers
- A storage shape that survives future M2 narrative work, where users may simultaneously be a player + an author + an admin (additive capabilities, not a tier ladder)

The shape decision now is what's expensive to change later. Schema choices for a single-column enum vs a junction table reach into RLS policies, server actions, RPC bodies, and UI code — touching all of them in one migration is costly.

## Options considered

1. **Postgres enum type** (`create type user_role as enum (...)`)
2. **Text column + check constraint** + abstraction helper (chosen)
3. **Junction table `user_roles (user_id, role)` now**
4. **Supabase auth metadata** (`raw_app_meta_data.role`)

## Choice

Text column on `public.profiles` with a `check (role in (...))` constraint, fronted by a SECURITY DEFINER function `public.has_role(target text)`. Every consumer — RLS policy, RPC body, server action, page guard — reads through `has_role()`. The column itself is never queried directly.

App-side wrapper at `lib/auth/role.ts` exports `hasRole(role)` and `currentRole()`.

Initial enum values: `player`, `admin`, `bot`. Default `player`.

`bot` is a **tag, not a privilege tier** — bots have identical capabilities to players (so e2e tests pass unchanged), but the tag enables targeted cleanup of test-fixture accounts without affecting real human testers. Set by the Playwright fixture at user creation. Admins can also re-tag any account via the `/admin` user table.

## Why not a Postgres enum

`alter type ... add value` has the no-transaction-scope gotcha (mostly relaxed in PG15+ but still finicky in migrations). Renaming or removing values requires recreate. Text + check constraint = one-line forever.

## Why not a junction table yet

YAGNI. Only one overlap case exists today (an admin who also plays games), and that's handled fine by "admin can do everything player can do." Multi-role narrative authors don't exist yet. Junction table adds RLS join overhead + UI complexity for zero current benefit.

## Why the abstraction layer matters

Future M2 narrative work is likely to need additive capabilities — a user may simultaneously be a player + an author + an admin. When that lands, the storage must move from `profiles.role` (single value) to `public.user_roles (user_id, role)` (junction). Centralizing all reads behind `has_role()` makes that swap mechanical:

- All RLS policies call `public.has_role('admin')`, not `select role from profiles where ...`
- All app code calls `hasRole('admin')` from `lib/auth/role.ts`
- The junction migration changes only the body of `has_role()` and the helper file. RLS policies, RPCs, pages, and components untouched.

## Migration cost ladder

| Future change | Cost |
|---|---|
| Add `moderator` / `banned` to enum | One migration: alter check constraint |
| Swap to junction `user_roles` table | One migration + ~20 lines in `has_role()` + helper file |
| Per-role permissions metadata | Add columns to junction or lookup table, extend helper signature |

## Convention

`profiles.role` column is **private to `has_role()`**. No app code, no RLS policy, no RPC reads it directly. Enforce via PR review. CI grep check for `\.role\b` against `profiles` outside the helper file is a possible future guard.

## Risks / follow-ups

- The convention relies on PR discipline until a CI lint rule lands. If a future change reads `profiles.role` directly, the junction-table migration becomes a hunt-and-replace exercise instead of a one-file edit.
- `bot` tag is set by the fixture at creation time, but Taylor's seed migration always flips `taylor@redlamp.org` back to `admin` (idempotent). If the fixture runs before the seed in a fresh environment, both run cleanly. Order independence is intentional.
- The first admin is seeded by hardcoded UUID. Loss of Taylor's account would require a manual SQL update via Supabase Studio.

## See also

- [[mocs/decisions]]
- [[decision-auth-email-password]] — built on top of the existing email + password auth
- `docs/superpowers/specs/2026-05-12-admin-tooling-and-invite-gate-design.md`
- `docs/superpowers/plans/2026-05-12-admin-tooling-and-invite-gate.md`
