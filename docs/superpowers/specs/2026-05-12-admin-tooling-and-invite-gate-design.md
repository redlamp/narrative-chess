# Admin Tooling and Invite Gate — Design

**Date:** 2026-05-12
**Status:** draft, awaiting user review
**Related:** Pre-public-release ramp per `wiki/projects/narrative-chess-v2.md`. Queued after Library Design Pass (shipped 2026-05-11).

## Context

The project sits on hosted Supabase with 33 users + 642 games accumulated from solo dev + e2e testing (26 real players, 7 ghost accounts, 334 stale `in_progress`, 39 dangling `open`). Before inviting outside testers, three things need to exist:

1. **Cleanup capacity** — a way to wipe accumulated junk games and accounts without writing manual SQL each time
2. **Account types** — currently there is no admin/role surface at all. Need at least an admin tier to gate the cleanup tooling and any future moderation. Designed so future M2 narrative work (authors, characters) can extend without re-shaping the schema
3. **Tester onboarding** — current signup is open and email-confirm-off. Want gated signup so the doors stay closed while only invited testers come in

The approach is to build the admin surface and invite gate **first**, then use the admin tool itself to perform the cleanup right before opening the doors. No one-off cleanup scripts; the admin tool is the cleanup mechanism.

## Goal

Ship `/admin` (gated to admin role), a single-use invite-code signup gate, re-enabled email confirmation, and three nuke actions (games-only, bots-only, all non-admins). After implementation, Taylor can:

- See current users + games + signup activity at a glance
- Generate and revoke invite codes
- Promote / demote other accounts
- Wipe the accumulated junk in three escalating tiers
- Hand a code to a tester who can sign up, confirm their email, and play a game

## Scope

In:

- `profiles.role` column with `('player', 'admin', 'bot')` and `has_role()` SECURITY DEFINER helper
- `invite_codes` table with single-use validation via RPC
- `admin_audit` append-only log
- `/admin` page (stats, users, invite codes, danger zone)
- Three nuke RPCs (games, bots, non-admin users)
- Signup form `invite_code` field + validation + consume
- Email confirmation re-enabled + `/auth/confirm` + `/auth/reset-password` + `/auth/check-email`
- E2e coverage: role gate, invite flow, nuke safeguards
- Bot tagging on e2e fixture user creation

Out (deferred):

- Per-record surgical controls (abort one game, delete one user, reset one password) — admin UI v2
- Moderator role / banned role — wait until needed
- Multi-role junction table — wait for M2 narrative
- Soft-delete / undo / restore — closed beta accepts hard delete
- Custom SMTP provider — fine on Supabase free tier for handful of testers
- Anonymous / OAuth signin — still deferred per [[decision-auth-email-password]]
- Public invite landing page (the link goes straight to `/sign-up`)
- Admin-action permalinks or RSS / webhook on signups

## Architecture

```
supabase/migrations/
|- <ts>_add_role_to_profiles.sql       role column + has_role() helper
|- <ts>_seed_first_admin.sql           promote Taylor by UUID
|- <ts>_invite_codes.sql               table + RLS + consume_invite_code RPC
|- <ts>_admin_audit.sql                append-only audit log
|- <ts>_admin_actions.sql              three nuke RPCs

app/admin/
|- page.tsx                  [SC]  server component, role-guarded, four panels
|- actions.ts                [SA]  setRole, createInviteCode, revokeInviteCode,
|                                  nukeAllGames, nukeAllBots, nukeAllNonAdminUsers
|- components/
   |- StatsPanel.tsx         [SC]  user count, game counts, recent activity
   |- UsersTable.tsx         [CC]  paginated user table with role select
   |- InviteCodesPanel.tsx   [CC]  generate / revoke / filter
   |- DangerZone.tsx         [CC]  three nuke buttons + typed-name guard
   |- NukeConfirmDialog.tsx  [CC]  shared confirmation modal

app/(auth)/
|- sign-up/
   |- page.tsx               modify: add invite_code field, top of form
   |- actions.ts             modify: validate + consume code + rollback on failure

app/auth/
|- confirm/route.ts          new: handle email confirmation token exchange
|- reset-password/page.tsx   new: request form + new-password form
|- check-email/page.tsx      new: post-signup wait page

lib/auth/
|- role.ts                   new: hasRole, currentRole helpers

middleware.ts                modify: /admin redirect for non-admins

e2e/
|- lib/auth-helper.ts        modify: ensureUser defaults role='bot', add promoteToAdmin
|- admin/
   |- role-gate.spec.ts      new: redirect player, allow admin
   |- invite-flow.spec.ts    new: generate -> sign up -> see consumption
   |- nuke-safeguards.spec.ts new: typed-name guard, self-protection, audit row
```

[SC] = server component, [CC] = client component, [SA] = server action.

## Data model

### `profiles.role` column

```sql
alter table public.profiles
  add column role text not null default 'player'
  check (role in ('player','admin','bot'));

create index profiles_role_idx on public.profiles(role) where role <> 'player';

create or replace function public.has_role(target text)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = target
  );
$$;

grant execute on function public.has_role(text) to authenticated;
```

Partial index — most users are `player`, so the index only stores admin + bot rows. Cheap lookup for "list all admins."

### Seed first admin (idempotent)

```sql
update public.profiles
set role = 'admin'
where user_id = '14e5b50b-3757-4ae7-8bcb-00aecdc57580';  -- taylor@redlamp.org
```

Hardcoded UUID. Runs once. Idempotent — re-runs are no-ops. After this lands, role grants flow through `/admin` UI.

### `invite_codes` table + consume RPC

```sql
create table public.invite_codes (
  code text primary key,                          -- e.g. random 8-char base32
  created_by uuid not null references public.profiles(user_id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,                         -- nullable = no expiry
  consumed_by uuid references public.profiles(user_id),
  consumed_at timestamptz,
  note text                                       -- "for sarah", "twitter ramp", etc.
);

alter table public.invite_codes enable row level security;

create policy invite_codes_admin_all on public.invite_codes
  for all using (public.has_role('admin'))
  with check (public.has_role('admin'));

create function public.consume_invite_code(p_code text, p_user_id uuid)
returns void
language plpgsql security definer
as $$
declare
  v_consumed_by uuid;
  v_expires_at timestamptz;
begin
  select consumed_by, expires_at into v_consumed_by, v_expires_at
  from public.invite_codes where code = p_code for update;

  if not found then raise exception 'invalid_invite_code'; end if;
  if v_consumed_by is not null then raise exception 'invite_code_already_used'; end if;
  if v_expires_at is not null and v_expires_at < now() then
    raise exception 'invite_code_expired';
  end if;

  update public.invite_codes
    set consumed_by = p_user_id, consumed_at = now()
    where code = p_code;
end;
$$;

grant execute on function public.consume_invite_code(text, uuid) to service_role;
```

RPC is `service_role` only — called from the signup server action after user creation. The `for update` row lock prevents two-tester races on the same code.

### `admin_audit` append-only log

```sql
create table public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(user_id),
  action text not null,                           -- 'nuke_games' | 'nuke_bots' | etc.
  target_count int not null default 0,
  details jsonb,                                  -- arbitrary action-specific payload
  created_at timestamptz not null default now()
);

alter table public.admin_audit enable row level security;

create policy admin_audit_admin_select on public.admin_audit
  for select using (public.has_role('admin'));
-- no insert/update/delete policies; written via SECURITY DEFINER RPCs only
```

Never deleted. Rendered as a footer on `/admin`.

### Nuke RPCs

Three SECURITY DEFINER functions, each performing its own `has_role('admin')` check before running, each writing to `admin_audit` before deleting:

- `admin_nuke_all_games()` — wipes `game_observers` → `game_moves` → `games`
- `admin_nuke_all_bots()` — selects `profiles where role='bot'`, deletes their game records, then their profile rows. Auth user deletion happens in the server action via `auth.admin.deleteUser()` because `auth.users` writes need elevated grants outside SECURITY DEFINER context
- `admin_nuke_all_non_admin_users_db_only()` — same as bots but `role in ('player','bot')`. Three guards: caller is admin, self excluded from target set, at least one admin remains post-delete

## Auth + signup gate flow

Signup form gains one field at the top: `invite_code` (8 chars, base32 charset, auto-uppercased). Layout reinforces the gate: code → email → display name → password.

Server action sequence:

1. Validate input shape (Zod: code matches `^[A-Z2-7]{8}$`; rest unchanged)
2. `supabase.auth.signUp(email, password)` creates `auth.users` row + triggers profile insert
3. Call `consume_invite_code(code, new_user_id)` via service-role client
4. On RPC failure: `auth.admin.deleteUser()` to roll back the half-created user, return error to form
5. On success: redirect to `/auth/check-email` page

Tester-visible errors:

- `Invite code not recognized` — invalid code
- `Invite code already used` — race condition or shared code
- `Invite code expired` — past expiry
- `Email already registered` — existing Supabase error (code stays unconsumed so tester can retry with another email)

The race window between user create and code consume is microseconds. The cleanup loop in step 4 catches any leftover. A pathological failure (network blip mid-cleanup) leaves an orphan `auth.users` row with no profile + no consumed code; out of scope for v1 detection.

**Email confirmation re-enabled** as part of this ramp (already on the checklist in [[decision-auth-email-password]]). Pieces:

- Toggle on in Supabase dashboard (Auth → Providers → Email → Confirm email = ON)
- Customize three email templates (confirm, recover, magic-link)
- `/auth/confirm` route handler — exchanges `?token_hash=...&type=signup` for session cookies, redirects to `/`
- `/auth/reset-password` request form + new-password form
- `/auth/check-email` post-signup page — "We sent a link to {email}; click it to finish signing up"

E2e fixture continues to use `email_confirm: true` at admin-API create time, so tests stay unaffected by the new gate.

Supabase free-tier SMTP has rate limits. Fine for handful of testers. Configure custom SMTP (Resend / Postmark / SES) before any wider ramp.

## /admin page

Single route `app/admin/page.tsx`, server component, four panels stacked vertically.

**Page guard (defense in depth):**

- Page-level: `has_role('admin')` RPC at the top, redirect non-admins to `/`
- Middleware-level: rejects `/admin` for non-admins (skips unnecessary render)

**Panel 1 — Stats dashboard.** Four stat cards (total users with admin/player breakdown, total games with status breakdown, signups this week, games started this week). Two compact tables below: recent signups (10 rows: email, display name, role, joined date), recent games (10 rows: white, black, status, started date, game link). Bots filtered out of recent-signups by default — keeps the signal focused on real audience.

**Panel 2 — User management.** Paginated user table (20/page). Columns: email, display name, role, joined date, games played, last seen. Role column is a `<select>` with `player` / `admin` / `bot` — change triggers `setRole` server action with confirmation modal. Bot rows render with a muted gray pill. Filter chip: "Hide bots" (default on). Self-demotion blocked client-side + server-side.

**Panel 3 — Invite codes.** "Generate code" form: note field + expires-in dropdown (never / 7 days / 30 days, default 30 days). Below: table of codes with copy-to-clipboard on click, filter chips (all / unused / used / expired), revoke button on unused rows.

**Panel 4 — Danger zone.** Oxblood border, visually quarantined. Three buttons, each with their own typed-name confirmation modal:

1. **Delete all games** — wipes chess history, preserves users. Type `delete all games`
2. **Delete all bot accounts** — targeted cleanup of e2e/test accounts. Type `delete all bot accounts`
3. **Delete all non-admin users** — broad reset (player + bot). Type `delete all non-admin users` + check the "I have a backup or I don't care about this data" checkbox

**Audit footer.** "Recent admin actions" — last 20 rows from `admin_audit`.

**Nav surface.** Small "Admin" link in the account dropdown, only visible to admins via server-side `has_role` check.

Theme reuses existing Fraunces + Newsreader + JetBrains Mono stack. Stat numbers in Fraunces, big and confident. Tables match the existing book-card / catalogue aesthetic (cream paper, ink text, oxblood for destructive). Reuses shadcn `Card`, `Button`, `Dialog`, `Select`, `Table` primitives.

## Nuke action mechanics

All three actions:

- Re-check `has_role('admin')` at the action level (not just the page)
- Write to `admin_audit` before deleting
- Run a typed-name confirmation modal (case-sensitive match required)
- Show progress + result banner

**Action A — Delete all games.** SECURITY DEFINER RPC deletes in order: `game_observers` → `game_moves` → `games`. Single transaction. Users, profiles, invite codes preserved.

**Action B — Delete all bots.** Computes `target_ids = profiles where role = 'bot'`. Self-protection automatic (caller is admin, not bot). RPC deletes: `game_observers` for targets → `games` where either player is a target (cascade clears `game_moves`) → `invite_codes.consumed_by` nullified for targets → `profiles` rows. Then server action loops `auth.admin.deleteUser(id)` for each target.

**Action C — Delete all non-admin users.** Broader scope: `role in ('player', 'bot')`. Three guards before run:

1. Caller is admin (RLS + RPC body check)
2. Caller excluded from target set (`where user_id != auth.uid()` belt + suspenders)
3. Pre-flight: at least one admin remains after delete, else raise `would_remove_last_admin`

Same delete ordering as Action B. Extra checkbox confirmation.

**Failure handling.** DB transaction failures roll back cleanly. Partial `auth.users` deletes (network blip mid-loop) get logged in the audit row with attempted-vs-succeeded counts; re-runs are idempotent (already-deleted users no-op).

**No undo.** Destructive ops are destructive. Audit row is the only record.

## Tester onboarding loop

End-to-end:

1. Admin opens `/admin` → invite codes panel → "Generate code" (note "for Sarah", expires 30 days) → 8-char base32 code appears, click to copy
2. Admin shares code out-of-band (email / Signal / DM)
3. Tester opens `/sign-up`, pastes code + fills form, submits → server validates + creates + consumes
4. Tester redirected to `/auth/check-email` → clicks email link → `/auth/confirm` exchanges token → logged in, lands on `/`
5. Tester plays normally
6. Admin sees consumption in invite codes panel + new row in recent signups

**Pre-public checklist (run once before generating the first real code):**

1. Migrations applied to hosted Supabase (`supabase db push`)
2. Taylor promoted to admin (seed migration ran)
3. Email confirmation toggled on in Supabase dashboard
4. Email templates customized
5. `/admin` accessible to Taylor, rejects others
6. Nuke a test game in dev to confirm audit trail capture
7. Generate a self-invite code, sign up as a throwaway address, walk the full flow
8. Then — only then — generate the first real invite code

## Recoverability

| Action | Recoverable? |
|---|---|
| Delete one game / invite code via UI | No, no soft delete. Audit row preserved. |
| Nuke all games | No. Audit row says how many, by whom, when. |
| Nuke all bots / non-admins | No, except via Supabase PITR if plan supports it. Verify before relying. |
| Migration mistake | Standard `supabase migration repair` flow per [[lesson-postgres-function-signature-drop]]. |

Project is closed beta with low-stakes data — absence of an undo button is acceptable.

## Open questions

None at time of writing. Re-review this section after implementation kicks off.

## Risks / follow-ups

- **PR discipline.** The `has_role()` indirection layer relies on no code reading `profiles.role` directly. A future CI grep check would catch regressions; until then, code review carries it.
- **First-admin loss.** If `taylor@redlamp.org` is ever deleted (e.g., bad nuke), there is no admin left to promote a replacement. Manual SQL via Supabase Studio is the recovery path.
- **SMTP rate limits.** Supabase free-tier SMTP could throttle if a tester loop runs hot during preview. Switch to Resend / Postmark before any non-trivial ramp.
- **Audit completeness.** Per-record surgical controls (deferred from v1) won't write audit rows when added. Future PR adding them must extend the audit pattern.

## See also

- [[mocs/decisions]]
- [[decision-role-storage-design]]
- [[decision-auth-email-password]]
- `docs/superpowers/plans/2026-05-12-admin-tooling-and-invite-gate.md` — implementation plan
- `wiki/projects/narrative-chess-v2.md` — current project state
- `wiki/notes/realtime-rls-gate-procedure.md` — run once post-migration set
