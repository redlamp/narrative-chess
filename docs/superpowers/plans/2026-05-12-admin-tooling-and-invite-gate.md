# Admin Tooling and Invite Gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build admin tooling (`/admin` page, three nuke actions, role-based access) and an invite-code signup gate so the project can be safely opened to a small handful of outside testers. Use the admin tool itself to perform the pre-public cleanup of the 642 accumulated games and 33 dev/test users.

**Architecture summary:** `profiles.role` text column (`player|admin|bot`) fronted by a `has_role()` SECURITY DEFINER helper. `invite_codes` table with single-use validation RPC. `admin_audit` append-only log. Three nuke RPCs gated by `has_role('admin')`. Modified signup action consumes invite code in same try-block as user create. Email confirmation re-enabled. `/admin` server component with four panels (stats, users, invites, danger zone).

**Tech stack:** Next.js 16.2, React 19, TypeScript, Tailwind v4, Supabase JS + SSR, shadcn/ui, Zod, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-12-admin-tooling-and-invite-gate-design.md`

**Branch:** `feat/admin-tooling-and-invites` off `dev`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `wiki/notes/decision-role-storage-design.md` | create | Capture role storage decision + rationale |
| `wiki/mocs/decisions.md` | modify | Index the new decision |
| `docs/superpowers/specs/2026-05-12-admin-tooling-and-invite-gate-design.md` | create | Spec |
| `docs/superpowers/plans/2026-05-12-admin-tooling-and-invite-gate.md` | create | This file |
| `supabase/migrations/<ts>_add_role_to_profiles.sql` | create | Role column + `has_role()` helper |
| `supabase/migrations/<ts>_seed_first_admin.sql` | create | Promote Taylor by UUID (idempotent) |
| `supabase/migrations/<ts>_invite_codes.sql` | create | Invite codes table + RLS + consume RPC |
| `supabase/migrations/<ts>_admin_audit.sql` | create | Append-only audit log table |
| `supabase/migrations/<ts>_admin_actions.sql` | create | Three nuke RPCs |
| `lib/auth/role.ts` | create | `hasRole(role)` + `currentRole()` server helpers |
| `app/(auth)/sign-up/actions.ts` | modify | Validate + consume invite code, rollback user on failure |
| `app/(auth)/sign-up/page.tsx` | modify | Add invite code field to form |
| `app/auth/confirm/route.ts` | create | Exchange `?token_hash=...&type=signup` for session |
| `app/auth/reset-password/page.tsx` | create | Request form + new-password form |
| `app/(auth)/check-email/page.tsx` | create | Post-signup wait page |
| `app/admin/page.tsx` | create | Server component, four panels, role-guarded |
| `app/admin/actions.ts` | create | Server actions (six total) |
| `app/admin/components/StatsPanel.tsx` | create | Stat cards + recent activity tables |
| `app/admin/components/UsersTable.tsx` | create | Paginated user table with role select |
| `app/admin/components/InviteCodesPanel.tsx` | create | Generate / revoke / filter codes |
| `app/admin/components/DangerZone.tsx` | create | Three nuke buttons |
| `app/admin/components/NukeConfirmDialog.tsx` | create | Shared typed-name confirmation modal |
| `middleware.ts` | modify | Add `/admin` rejection for non-admins |
| `components/AccountDropdown.tsx` (or equivalent) | modify | Show "Admin" link to admins only |
| `e2e/lib/auth-helper.ts` | modify | `ensureUser` defaults role='bot', add `promoteToAdmin` |
| `e2e/admin/role-gate.spec.ts` | create | Verify `/admin` redirects player, allows admin |
| `e2e/admin/invite-flow.spec.ts` | create | Generate code → sign up → see consumption |
| `e2e/admin/nuke-safeguards.spec.ts` | create | Typed-name guard + self-protection + audit row |

---

## Task 1: Docs + branch (this commit)

**Files:**
- Create: `wiki/notes/decision-role-storage-design.md`
- Modify: `wiki/mocs/decisions.md`
- Create: `docs/superpowers/specs/2026-05-12-admin-tooling-and-invite-gate-design.md`
- Create: `docs/superpowers/plans/2026-05-12-admin-tooling-and-invite-gate.md`

- [x] **Step 1:** Branch off dev: `git checkout -b feat/admin-tooling-and-invites`
- [x] **Step 2:** Write the four documentation files (in progress at time of plan creation)
- [ ] **Step 3:** Commit + push: `chore: capture role storage decision + admin tooling spec + impl plan`

**Verification:** All four files present on the branch. `wiki/mocs/decisions.md` lists the new decision under Infrastructure / repo section.

---

## Task 2: Role column + has_role helper migration

**Files:**
- Create: `supabase/migrations/<ts>_add_role_to_profiles.sql`

- [ ] **Step 1:** Generate migration filename: `supabase migration new add_role_to_profiles`
- [ ] **Step 2:** Write migration content:

```sql
-- 1. Add role column with check constraint
alter table public.profiles
  add column role text not null default 'player'
  check (role in ('player','admin','bot'));

-- 2. Partial index on non-player rows (admins + bots are queried by role; players never are)
create index profiles_role_idx on public.profiles(role) where role <> 'player';

-- 3. SECURITY DEFINER helper — sole role-read surface
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

-- 4. Convention reminder
comment on column public.profiles.role is
  'Read only via public.has_role(). Never queried directly. See wiki/notes/decision-role-storage-design.md.';
```

- [ ] **Step 3:** `supabase db push` to hosted, verify migration applied cleanly
- [ ] **Step 4:** Spot-check in Supabase Studio: every existing profile row has `role = 'player'`

**Verification:** `select role, count(*) from public.profiles group by role` returns one row, `player = 33`.

---

## Task 3: Seed first admin migration

**Files:**
- Create: `supabase/migrations/<ts>_seed_first_admin.sql`

- [ ] **Step 1:** Generate migration filename: `supabase migration new seed_first_admin`
- [ ] **Step 2:** Write migration content:

```sql
-- Promote Taylor's account to admin. Idempotent — re-runs are no-ops.
-- UUID hardcoded per wiki/projects/narrative-chess-v2.md.
update public.profiles
set role = 'admin'
where user_id = '14e5b50b-3757-4ae7-8bcb-00aecdc57580';
```

- [ ] **Step 3:** `supabase db push`
- [ ] **Step 4:** Verify: `select user_id, role from public.profiles where role = 'admin'` returns one row

**Verification:** Taylor's profile has `role = 'admin'`. All other profiles unchanged.

---

## Task 4: Invite codes table + consume RPC migration

**Files:**
- Create: `supabase/migrations/<ts>_invite_codes.sql`

- [ ] **Step 1:** Generate migration filename: `supabase migration new invite_codes`
- [ ] **Step 2:** Write migration content (the full table + RLS + RPC per spec §Data model)
- [ ] **Step 3:** `supabase db push`
- [ ] **Step 4:** Smoke test in SQL editor:
  - As admin: `insert into public.invite_codes (code, created_by, note) values ('TESTAAAA', auth.uid(), 'smoke');` succeeds
  - As non-admin (impersonate via JWT): same insert fails with RLS
  - `select public.consume_invite_code('TESTAAAA', '<admin uuid>');` succeeds first time, raises `invite_code_already_used` on second call

**Verification:** Three RLS scenarios pass. `consume_invite_code` returns void on first call, raises on subsequent calls.

---

## Task 5: lib/auth/role.ts helper

**Files:**
- Create: `lib/auth/role.ts`

- [ ] **Step 1:** Write the helper:

```ts
import { createClient } from "@/lib/supabase/server";

export async function hasRole(role: "player" | "admin" | "bot"): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_role", { target: role });
  if (error) return false;
  return data === true;
}

export async function currentRole(): Promise<"player" | "admin" | "bot" | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  // Note: this is the ONE allowed direct read of profiles.role, scoped to the
  // current user's own row. All admin/permission checks go through hasRole().
  return (data?.role as "player" | "admin" | "bot") ?? null;
}
```

- [ ] **Step 2:** `bunx tsc --noEmit` clean

**Verification:** Helper compiles. Type imports resolve. Pure-server module (no `"use client"`).

---

## Task 6: Signup gate — invite code field + consume

**Files:**
- Modify: `app/(auth)/sign-up/actions.ts`
- Modify: `app/(auth)/sign-up/page.tsx`

- [ ] **Step 1:** Update Zod schema in `actions.ts`:

```ts
const SignUpSchema = z.object({
  inviteCode: z.string().regex(/^[A-Z2-7]{8}$/, "Invite code must be 8 chars (base32)"),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  displayName: z.string().min(1).max(60),
});
```

- [ ] **Step 2:** Restructure `signUp()` action:
  1. Validate input
  2. `supabase.auth.signUp(...)` → get new user
  3. Service-role client: call `consume_invite_code(inviteCode, newUserId)`
  4. On any error in step 3: service-role `auth.admin.deleteUser(newUserId)` to roll back
  5. Return success → redirect to `/auth/check-email`

- [ ] **Step 3:** Map RPC error codes to user-facing messages:

| RPC error | Message |
|---|---|
| `invalid_invite_code` | Invite code not recognized |
| `invite_code_already_used` | Invite code already used |
| `invite_code_expired` | Invite code expired |

- [ ] **Step 4:** Add invite code field to `page.tsx` as the first field. Label `Invite code`, monospace input, `autoComplete="off"`, auto-uppercase on input.

- [ ] **Step 5:** Update existing signup e2e (if any) to pass an invite code (use the fixture's `ensureInviteCode` helper introduced in Task 12)

**Verification:** `bun run lint` + `bunx tsc --noEmit` clean. Manual test: signup with no code fails validation; with fake code shows the right error; with valid code completes.

---

## Task 7: Email confirmation flow

**Files:**
- Create: `app/auth/confirm/route.ts`
- Create: `app/auth/reset-password/page.tsx`
- Create: `app/(auth)/check-email/page.tsx`
- Supabase dashboard: toggle email confirm ON, customize three templates (manual)

- [ ] **Step 1:** Write `app/auth/confirm/route.ts`:

```ts
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as
    | "signup" | "magiclink" | "recovery" | "email_change" | null;
  const next = searchParams.get("next") ?? "/";

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/login?error=missing_token`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
```

- [ ] **Step 2:** Write `app/(auth)/check-email/page.tsx` — minimal server component, reads `?email=` from search params, shows "Check {email} for a confirmation link" + a small "Didn't get it? Try logging in to resend" link

- [ ] **Step 3:** Write `app/auth/reset-password/page.tsx` — two-state form:
  - State A (no `code` param): email field → `supabase.auth.resetPasswordForEmail()` → "Check your email"
  - State B (with valid session from recovery link): new password field → `supabase.auth.updateUser({ password })` → redirect `/`

- [ ] **Step 4:** Update post-signup redirect in `actions.ts` to `/auth/check-email?email=<email>`

- [ ] **Step 5:** **Supabase dashboard (manual)** — toggle on email confirmation, customize templates. Document the exact toggle path in the commit message body for reproducibility.

- [ ] **Step 6:** Verify e2e fixture still works (`ensureUser` calls `auth.admin.createUser` with `email_confirm: true`, bypasses the gate)

**Verification:** Sign up locally, verify the "check email" page appears, find the email in Mailpit or Supabase Studio (use the auth.users `confirmation_token` to construct the confirm URL if SMTP not configured locally), click link → land on `/` logged in.

---

## Task 8: Admin audit log migration

**Files:**
- Create: `supabase/migrations/<ts>_admin_audit.sql`

- [ ] **Step 1:** Generate migration: `supabase migration new admin_audit`
- [ ] **Step 2:** Write per spec §Data model. Only admin select policy; no insert/update/delete policies (writes happen via SECURITY DEFINER RPCs).
- [ ] **Step 3:** `supabase db push`

**Verification:** `select * from public.admin_audit;` returns empty set. As non-admin: select fails with RLS.

---

## Task 9: Nuke RPCs migration

**Files:**
- Create: `supabase/migrations/<ts>_admin_actions.sql`

- [ ] **Step 1:** Generate migration: `supabase migration new admin_actions`
- [ ] **Step 2:** Write the three RPCs, each with:
  - Internal `has_role('admin')` check; raise `unauthorized` if false
  - Insert into `admin_audit` before deleting (capture target count + actor id)
  - SECURITY DEFINER, language plpgsql
  - `revoke execute from public; grant execute to authenticated;`

Function signatures:

```sql
create function public.admin_nuke_all_games() returns int
-- returns: count of games deleted
create function public.admin_nuke_all_bots() returns int
-- returns: count of bot profiles deleted (auth.users delete happens in server action)
create function public.admin_nuke_all_non_admin_users_db_only() returns int
-- returns: count of profiles deleted; raises 'would_remove_last_admin' if guard trips
```

- [ ] **Step 3:** `supabase db push`
- [ ] **Step 4:** Smoke test as admin: create one fake game, run `select public.admin_nuke_all_games();`, verify it returns 1 and audit row appears

**Verification:** All three RPCs exist + return int. Audit row written before each delete.

---

## Task 10: Admin server actions

**Files:**
- Create: `app/admin/actions.ts`

- [ ] **Step 1:** Implement six actions, all with `"use server"` directive:
  - `setRole(targetUserId: string, newRole: "player" | "admin" | "bot")`
  - `createInviteCode(note: string, expiresInDays: number | null)`
  - `revokeInviteCode(code: string)`
  - `nukeAllGames()` — calls RPC, no extra cleanup needed
  - `nukeAllBots()` — calls RPC, then loops `auth.admin.deleteUser()` for each returned id
  - `nukeAllNonAdminUsers()` — calls RPC, then loops `auth.admin.deleteUser()`

- [ ] **Step 2:** Each action begins with `if (!(await hasRole("admin"))) throw new Error("unauthorized");`
- [ ] **Step 3:** Self-demotion guard in `setRole`: if `newRole !== 'admin' && targetUserId === currentUserId` then throw
- [ ] **Step 4:** Code generation in `createInviteCode`: 8 chars from base32 alphabet `ABCDEFGHIJKLMNOPQRSTUVWXYZ234567` via `crypto.getRandomValues`. Retry on collision (PK conflict → regenerate up to 5 times)
- [ ] **Step 5:** `revalidatePath("/admin")` after each mutating action

**Verification:** `bun run lint` + `bunx tsc --noEmit` clean. Each action signature matches what the components call.

---

## Task 11: Admin page + components

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/admin/components/StatsPanel.tsx`
- Create: `app/admin/components/UsersTable.tsx`
- Create: `app/admin/components/InviteCodesPanel.tsx`
- Create: `app/admin/components/DangerZone.tsx`
- Create: `app/admin/components/NukeConfirmDialog.tsx`
- Modify: `middleware.ts`
- Modify: `components/AccountDropdown.tsx` (or equivalent — verify exact file)

- [ ] **Step 1:** Write `app/admin/page.tsx`:
  - Server component
  - Top: `if (!(await hasRole("admin"))) redirect("/")`
  - Parallel fetch: stats counts, recent signups, recent games, paginated users, all invite codes, recent audit
  - Render four panels stacked, audit footer last

- [ ] **Step 2:** Write each component per spec §/admin page. Reuse existing shadcn `Card`, `Button`, `Dialog`, `Select`, `Table` primitives.

- [ ] **Step 3:** `NukeConfirmDialog.tsx` is the shared modal — props: `actionLabel`, `requiredText`, `description`, `onConfirm`, optional `requireCheckbox`. `DangerZone` instantiates three of these with different prop sets.

- [ ] **Step 4:** Bot filtering: `UsersTable` accepts a `hideBots: boolean` prop, defaults true. Toggle chip flips it via URL search param (`?show_bots=1`). Recent signups panel always filters bots.

- [ ] **Step 5:** Update `middleware.ts`:
  - On `/admin/*` request: call `has_role('admin')` RPC via server client
  - If false: redirect to `/`
  - (Page-level guard still runs as defense in depth)

- [ ] **Step 6:** Update account dropdown to show "Admin" link when `await hasRole("admin")` is true. Server-side check, no client-side leak.

**Verification:** Visit `/admin` as Taylor → see four panels with real data. Visit as a non-admin user → redirect to `/`. View page source on a non-admin session → no "Admin" link in dropdown markup.

---

## Task 12: E2e fixture changes

**Files:**
- Modify: `e2e/lib/auth-helper.ts`

- [ ] **Step 1:** Update `ensureUser` signature to accept optional `role` param defaulting to `'bot'`:

```ts
export async function ensureUser(
  email: string,
  password: string,
  opts: { role?: "player" | "admin" | "bot" } = {},
): Promise<{ id: string }> {
  const role = opts.role ?? "bot";
  // ... existing create-or-find logic ...
  // After user exists, update profile role:
  await admin.from("profiles").update({ role }).eq("user_id", user.id);
  return user;
}
```

- [ ] **Step 2:** Add helper:

```ts
export async function promoteToAdmin(userId: string) {
  const admin = getAdmin();
  await admin.from("profiles").update({ role: "admin" }).eq("user_id", userId);
}
```

- [ ] **Step 3:** Add helper:

```ts
export async function ensureInviteCode(opts: { note?: string } = {}): Promise<string> {
  const admin = getAdmin();
  const code = generateBase32(8);
  await admin.from("invite_codes").insert({
    code,
    created_by: TAYLOR_UUID,           // hardcoded — fixture knows the admin
    note: opts.note ?? "e2e fixture",
  });
  return code;
}
```

- [ ] **Step 4:** Audit existing e2e specs that call `ensureUser` — confirm none break with the new bot default. Taylor's account stays admin because the seed migration runs after fixture writes (and is idempotent).

**Verification:** `bunx playwright test` (full suite) still green.

---

## Task 13: E2e — role gate spec

**Files:**
- Create: `e2e/admin/role-gate.spec.ts`

- [ ] **Step 1:** Test 1: `/admin` redirects player-role user to `/`
  - Create a fresh user via `ensureUser` (defaults to bot — explicitly pass `{ role: "player" }`)
  - Log in, navigate to `/admin`, assert `page.url()` ends with `/`

- [ ] **Step 2:** Test 2: `/admin` loads for admin
  - Use Taylor's account (post-seed-migration, role='admin')
  - Log in, navigate to `/admin`, assert page contains "Stats" + "Users" + "Invite codes" + "Danger zone" headings

**Verification:** Both tests green via `bunx playwright test e2e/admin/role-gate.spec.ts`.

---

## Task 14: E2e — invite flow spec

**Files:**
- Create: `e2e/admin/invite-flow.spec.ts`

- [ ] **Step 1:** Two-context test:
  - Admin context: log in as Taylor, navigate to `/admin`, click "Generate code" with note "e2e-test", capture the code
  - Tester context: navigate to `/sign-up`, paste code, fill form, submit
  - Tester context: assert redirect to `/auth/check-email`
  - (Skip the email confirmation step — fixture pre-confirms via service role for downstream tests)
  - Admin context: refresh `/admin`, assert the code now shows `consumed by: <tester-email>`

- [ ] **Step 2:** Negative case: signup with `BADBADAD` (8 chars but not in codes table) → expect "Invite code not recognized" error

**Verification:** Both tests green.

---

## Task 15: E2e — nuke safeguards spec

**Files:**
- Create: `e2e/admin/nuke-safeguards.spec.ts`

- [ ] **Step 1:** Test 1 — typed-name guard:
  - Log in as Taylor, navigate to `/admin` Danger zone
  - Click "Delete all games" → modal opens
  - Confirm submit button is disabled
  - Type `delete all game` (one char short) → still disabled
  - Type the full `delete all games` → enabled
  - Click submit → expect success banner

- [ ] **Step 2:** Test 2 — self-protection:
  - As Taylor (only admin), click "Delete all non-admin users" → modal opens
  - Type the confirmation text + check the backup checkbox + submit
  - Expect: action succeeds, Taylor still in `profiles` table afterward, only Taylor remains
  - (Test runs at the end of the spec file since it nukes other users)

- [ ] **Step 3:** Test 3 — audit row written:
  - After any nuke, query `admin_audit` via service-role client
  - Assert: latest row has `actor_id = Taylor` + correct `action` string + `target_count >= 0`

**Verification:** All three tests green. Run with `--retries=0` to catch flakiness.

---

## Task 16: PR + smoke + ship

**Files:** none (process steps)

- [ ] **Step 1:** Local sanity:
  - `bun run lint` clean
  - `bunx tsc --noEmit` clean
  - `bunx playwright test` full suite green
  - `supabase db lint` clean (if Supabase CLI installed locally)

- [ ] **Step 2:** Push branch + open PR to dev:

```sh
git push -u origin feat/admin-tooling-and-invites
gh pr create --base dev --title "feat: admin tooling + invite gate + role storage" --body "$(cat <<EOF
# Admin tooling + invite gate

Closes the pre-public-release gap before inviting outside testers.

Adds:
- profiles.role text column ('player' | 'admin' | 'bot') + has_role() helper
- invite_codes table + single-use consume RPC
- admin_audit append-only log
- /admin page (stats, users, invite codes, danger zone)
- Three nuke actions with typed-name confirmation + audit trail
- Signup invite code field + email confirmation re-enabled

Spec: docs/superpowers/specs/2026-05-12-admin-tooling-and-invite-gate-design.md
Plan: docs/superpowers/plans/2026-05-12-admin-tooling-and-invite-gate.md
Decision: wiki/notes/decision-role-storage-design.md

Manual step before merge: toggle email confirmation ON in Supabase dashboard,
customize the three email templates.
EOF
)"
```

- [ ] **Step 3:** Wait for CI: lint + typecheck + e2e (Playwright) all green
- [ ] **Step 4:** Manual smoke on preview deploy — walk the 7-step list in spec §Tester onboarding loop
- [ ] **Step 5:** Merge to dev: `gh pr merge --merge` (no-ff per project convention)
- [ ] **Step 6:** Open `dev → main` PR: `gh pr create --base main --title "ship: admin tooling + invite gate"`
- [ ] **Step 7:** Wait CI green, merge with `gh pr merge --squash`
- [ ] **Step 8:** Run pre-prod data plan against prod:
  1. Sign in as Taylor on prod `/admin`
  2. Visual stats check (642 games, 33 users)
  3. **Delete all games** (wipes chess history, preserves users + codes)
  4. **Delete all bot accounts** (clears any tagged e2e accounts on prod)
  5. **Delete all non-admin users** (final wipe — alt+2 etc.)
  6. Generate the first real invite code
- [ ] **Step 9:** Daily-log entry: `wiki/daily/2026-05-12.md` (or whichever day the ship happens) noting the cleanup numbers + first invite sent

**Verification:** Production `/admin` shows zero games, one user (Taylor), one or more unused invite codes. Audit log contains three rows for the cleanup actions.

---

## Verification — end to end

After all tasks complete:

1. `bun run lint` clean
2. `bunx tsc --noEmit` clean
3. `bunx playwright test e2e/admin/` — all three new specs green
4. `bunx playwright test` — full suite green (no regression on signup, gameplay, observer)
5. Manual smoke on preview walks spec §Tester onboarding loop
6. Audit row present in `public.admin_audit` after every nuke
7. `/admin` redirects non-admins to `/` (test with a fresh player account)
8. Signup with no invite code blocked at form validation; signup with used / expired / fake code shows correct error string
9. Prod cleanup executed; only Taylor remains; zero games; first invite code generated + sent

## Notes

- The `lib/auth/role.ts` helper file is the **only** allowed reader of `profiles.role`. All other consumers go through `has_role()`. Maintain this discipline in PR review.
- E2e fixture defaults `role='bot'` so accumulated CI runs can be wiped without affecting real test players. Taylor's seed migration always wins because it's idempotent.
- Email confirmation re-enable is partially manual (Supabase dashboard toggles). Document the dashboard steps in the relevant commit message body for reproducibility.
- Supabase free-tier SMTP is rate-limited. Fine for handful of testers; switch to Resend / Postmark / SES before any wider ramp.
- No undo on nuke actions. Audit trail is the only record. Closed beta with low-stakes data — accepting this.
