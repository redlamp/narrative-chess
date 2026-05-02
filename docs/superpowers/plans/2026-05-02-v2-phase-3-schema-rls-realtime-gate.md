# V2 Phase 3 — Schema + RLS + Realtime Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the `games` + `game_moves` schema with correct RLS policies and Realtime publications, and prove via a two-browser sanity test that subscribers actually receive events for rows they're authorized to see — the v1 failure mode that this gate exists to prevent.

**Architecture:** One migration creates both tables, indexes, RLS policies, and Realtime publication entries. A small diagnostic UI (kept in-repo, gated to authenticated users) subscribes to `game_moves` Realtime and renders received events live. The gate is passed when (a) participant subscribers receive events with row data, and (b) non-participant subscribers receive nothing.

**Tech Stack:** Postgres RLS, Supabase Realtime (`postgres_changes`), `@supabase/ssr` browser client, Next.js Client Component for diagnostic UI.

**Spec reference:** `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` Step I (the **CRITICAL GATE** before any board UI work).

**Prerequisites (Phase 2 must be done):** auth working, profiles auto-created, two test users in `auth.users` + `profiles`.

**Working branch:** `feat/phase-3-schema-rls-realtime`

**Why this is a gate:** v1 had Realtime publications and RLS policies. The publications fired events. But RLS policies denied the SELECT that Realtime needs to read the row before delivering it to the subscriber. Net: events arrived but rows came back as `null` to the subscriber, looking like silence. v2 must catch this **before** writing board UI, because debugging silent Realtime is much harder once UI is in the picture.

---

## Tasks

### Task 1: Branch off dev

**Files:** none (git only)

- [ ] **Step 1: Pull latest dev and branch**

```bash
cd C:/workspace/narrative-chess-v2
git checkout dev
git pull
git checkout -b feat/phase-3-schema-rls-realtime
```

Expected: switched to new branch.

### Task 2: Generate migration file

**Files:**
- Create: `supabase/migrations/<timestamp>_init_games.sql`

- [ ] **Step 1: Create empty migration**

```bash
cd C:/workspace/narrative-chess-v2
supabase migration new init_games
```

Note the generated filename.

### Task 3: Write `games` + `game_moves` schema

**Files:**
- Modify: `supabase/migrations/<timestamp>_init_games.sql`

- [ ] **Step 1: Write tables + indexes**

Open the generated migration file. Replace its contents with:

```sql
-- Phase 3 — games + game_moves + RLS + Realtime publication
-- Spec: docs/superpowers/specs/2026-05-02-v2-foundation-design.md §6.1, §6.2

set check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- 1. games — one row per game; current_fen + ply cached for O(1) move append
-- ----------------------------------------------------------------------------

create table public.games (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  white_id uuid references public.profiles(user_id) on delete set null,
  black_id uuid references public.profiles(user_id) on delete set null,
  status text not null check (status in (
    'open',          -- created, awaiting opponent
    'in_progress',   -- both players present, white to move
    'white_won',
    'black_won',
    'draw',
    'aborted'
  )),
  current_fen text not null
    default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  current_turn text not null default 'w' check (current_turn in ('w','b')),
  ply integer not null default 0 check (ply >= 0),
  ended_at timestamptz
);

comment on table public.games is 'One row per chess game. current_fen + ply cached for O(1) move append via make_move RPC (added Phase 4).';

create index games_status_idx on public.games (status);
create index games_white_id_idx on public.games (white_id);
create index games_black_id_idx on public.games (black_id);

-- updated_at maintenance (uses helper from Phase 2 init_profiles migration)
drop trigger if exists games_touch_updated_at on public.games;
create trigger games_touch_updated_at
  before update on public.games
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 2. game_moves — append-only ledger; primary key (game_id, ply)
-- ----------------------------------------------------------------------------

create table public.game_moves (
  game_id uuid not null references public.games(id) on delete cascade,
  ply integer not null check (ply > 0),
  san text not null,
  uci text not null check (uci ~ '^[a-h][1-8][a-h][1-8][qrbn]?$'),
  fen_after text not null,
  played_by uuid not null references public.profiles(user_id) on delete restrict,
  played_at timestamptz not null default now(),
  primary key (game_id, ply)
);

comment on table public.game_moves is 'Append-only move ledger. Inserts only via make_move RPC (Phase 4); RLS allows SELECT for game participants.';

create index game_moves_played_by_idx on public.game_moves (played_by);

-- ----------------------------------------------------------------------------
-- 3. RLS — both tables enabled
-- ----------------------------------------------------------------------------

alter table public.games enable row level security;
alter table public.game_moves enable row level security;

-- games SELECT: participants OR rows where status = 'open' (open invite list)
create policy "games_select_participants_or_open" on public.games
  for select to authenticated
  using (
    auth.uid() = white_id
    or auth.uid() = black_id
    or status = 'open'
  );

-- games INSERT: deferred. Phase 4 adds a create_game RPC; for now, INSERT only via service_role.
-- (No INSERT/UPDATE/DELETE policies = locked except via SECURITY DEFINER functions.)

-- game_moves SELECT: only participants of the game
create policy "game_moves_select_participants" on public.game_moves
  for select to authenticated
  using (
    exists (
      select 1
      from public.games g
      where g.id = game_moves.game_id
        and (auth.uid() = g.white_id or auth.uid() = g.black_id)
    )
  );

-- game_moves INSERT: deferred to Phase 4 make_move RPC.

-- ----------------------------------------------------------------------------
-- 4. Realtime publication
-- ----------------------------------------------------------------------------

alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_moves;
```

- [ ] **Step 2: Verify SQL parses (dry-run)**

```bash
cat supabase/migrations/<timestamp>_init_games.sql | head -20
```

Just visual confirmation. Real validation happens in Step 3.

### Task 4: Push migration to remote

**Files:** none (DB push)

- [ ] **Step 1: Push**

```bash
cd C:/workspace/narrative-chess-v2
supabase db push
```

Expected: prompts to confirm; applies migration; reports success.

If migration fails:

- Read the error carefully (line number + reason printed)
- Fix the SQL in the migration file
- Run `supabase db push` again
- Migrations are idempotent within `supabase db push` flow because failed pushes don't add to migration history

- [ ] **Step 2: Verify in Studio**

Open https://supabase.com/dashboard/project/<ref>/database/tables.

Expected:
- `games` table exists with all columns from Step 1
- `game_moves` table exists
- Both have RLS enabled (lock icon)
- Both have policies (visible under "Policies" tab on each table)

- [ ] **Step 3: Verify Realtime publications**

Open https://supabase.com/dashboard/project/<ref>/database/replication.

Expected: `supabase_realtime` publication includes `games` and `game_moves` (alongside `profiles` from Phase 2 — actually no, Phase 2 didn't add profiles to publication; only games and game_moves should be present from this migration).

- [ ] **Step 4: Commit migration**

```bash
git add supabase/migrations/
git commit -m "feat: games + game_moves schema with RLS + Realtime publications"
```

### Task 5: Create diagnostic page for Realtime sanity test

**Files:**
- Create: `app/diagnostics/realtime/page.tsx`
- Create: `app/diagnostics/realtime/RealtimeMonitor.tsx`

This page is intentionally kept in-repo (not deleted after Phase 3) so future regressions can be caught with one click. Gated to authenticated users only.

- [ ] **Step 1: Server Component wrapper that gates auth**

```tsx
// app/diagnostics/realtime/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RealtimeMonitor } from "./RealtimeMonitor";

export default async function RealtimeDiagnosticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Realtime + RLS Diagnostic</h1>
          <p className="text-sm text-foreground/70 mt-1">
            Logged in as <code className="text-xs">{user.email}</code> (<code className="text-xs">{user.id}</code>)
          </p>
        </div>

        <p className="text-sm">
          This page subscribes to <code>public.game_moves</code> for the game ID you enter below. Insert a row in
          Supabase Studio to test that events arrive AND the row data is visible (i.e. RLS allows the SELECT that
          Realtime depends on). If events arrive but rows are <code>null</code>, RLS is blocking the read — that's
          the v1 failure mode this gate prevents.
        </p>

        <RealtimeMonitor userId={user.id} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Client Component that subscribes**

```tsx
// app/diagnostics/realtime/RealtimeMonitor.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MoveEvent = {
  receivedAt: string;
  payloadType: "INSERT" | "UPDATE" | "DELETE" | "OTHER";
  newRow: unknown;
  oldRow: unknown;
};

export function RealtimeMonitor({ userId }: { userId: string }) {
  const [gameId, setGameId] = useState("");
  const [active, setActive] = useState(false);
  const [events, setEvents] = useState<MoveEvent[]>([]);
  const [status, setStatus] = useState<string>("idle");

  useEffect(() => {
    if (!active || !gameId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`diagnostic:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_moves",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          setEvents((prev) => [
            {
              receivedAt: new Date().toISOString(),
              payloadType: (payload.eventType ?? "OTHER") as MoveEvent["payloadType"],
              newRow: payload.new,
              oldRow: payload.old,
            },
            ...prev,
          ].slice(0, 50));
        }
      )
      .subscribe((s) => setStatus(`subscription: ${s}`));

    return () => {
      supabase.removeChannel(channel);
      setStatus("idle");
    };
  }, [active, gameId]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <label className="flex-1">
          <span className="text-xs font-medium text-foreground/70">game_id (uuid)</span>
          <input
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            disabled={active}
            placeholder="00000000-0000-0000-0000-000000000000"
            className="mt-1 w-full border rounded px-3 py-2 font-mono text-xs"
          />
        </label>
        <button
          onClick={() => setActive((v) => !v)}
          className="rounded bg-foreground text-background px-4 py-2 text-sm font-medium"
        >
          {active ? "Stop" : "Subscribe"}
        </button>
      </div>

      <div className="text-xs text-foreground/70">
        userId for RLS: <code>{userId}</code>
        <br />
        Status: <code>{status}</code>
      </div>

      <div className="border rounded p-3 max-h-96 overflow-auto">
        <p className="text-xs font-medium mb-2">Events ({events.length})</p>
        {events.length === 0 ? (
          <p className="text-xs text-foreground/50">No events yet. Insert a game_moves row in Supabase Studio.</p>
        ) : (
          <ul className="space-y-3 text-xs font-mono">
            {events.map((e, i) => (
              <li key={i} className="border-l-2 border-foreground/20 pl-3">
                <div className="text-foreground/60">{e.receivedAt} — {e.payloadType}</div>
                <pre className="text-[10px] mt-1 whitespace-pre-wrap break-all">
                  new = {JSON.stringify(e.newRow, null, 2)}
                </pre>
                {e.oldRow && Object.keys(e.oldRow).length > 0 ? (
                  <pre className="text-[10px] mt-1 whitespace-pre-wrap break-all">
                    old = {JSON.stringify(e.oldRow, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-foreground/60 leading-relaxed">
        <strong>Pass criteria:</strong> participant of the game (white_id or black_id matches your user_id) sees
        events with the inserted row's full data in <code>new</code>. Non-participant sees nothing (silence is correct).
        If a participant sees an event but <code>new</code> is empty/null, the Realtime publication is firing but RLS
        denied the SELECT — fix RLS before continuing.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verify dev server boots cleanly**

```bash
bun run dev
```

Open http://localhost:3000/diagnostics/realtime. Expected:

- Redirected to /login if not signed in (sign in as one of the Phase 2 test users)
- After sign in, the diagnostic UI appears
- Stop dev server

- [ ] **Step 4: Commit diagnostic page**

```bash
git add app/diagnostics/
git commit -m "feat: realtime+rls diagnostic page (gated to authenticated users)"
```

### Task 6: GATE — Positive test (participant receives event with row data)

**Files:** none (manual gate test)

This is the gate. It must pass before any subsequent work.

- [ ] **Step 1: Note the two test users' user_ids**

In Supabase Studio → Authentication → Users. Find `test1@example.com` (call its id `USER_A_ID`) and `test2@example.com` (`USER_B_ID`). Copy both.

- [ ] **Step 2: Insert a `games` row connecting both users**

Open Supabase Studio SQL editor (https://supabase.com/dashboard/project/<ref>/sql). Run:

```sql
insert into public.games (white_id, black_id, status)
values ('<USER_A_ID>', '<USER_B_ID>', 'in_progress')
returning id;
```

Note the returned `id` (call it `GAME_ID`).

- [ ] **Step 3: Browser 1 — log in as User A, open diagnostic page, subscribe**

Open Chrome (or your primary browser) → http://localhost:3000/login → sign in as `test1@example.com` → navigate to http://localhost:3000/diagnostics/realtime → paste `GAME_ID` into the input → click "Subscribe".

Expected status: `subscription: SUBSCRIBED`. Events list empty.

- [ ] **Step 4: Insert a game_moves row from Studio**

In Studio SQL editor:

```sql
insert into public.game_moves (game_id, ply, san, uci, fen_after, played_by)
values (
  '<GAME_ID>',
  1,
  'e4',
  'e2e4',
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  '<USER_A_ID>'
);
```

- [ ] **Step 5: Verify event arrives in Browser 1 with full row data**

Within ~1 second, Browser 1's diagnostic UI should show 1 event:

```
<timestamp> — INSERT
new = {
  "game_id": "<GAME_ID>",
  "ply": 1,
  "san": "e4",
  "uci": "e2e4",
  "fen_after": "...",
  "played_by": "<USER_A_ID>",
  "played_at": "..."
}
```

**This is the gate. PASS = User A (a participant) sees the event AND `new` is fully populated. FAIL modes:**

- No event arrives at all → Realtime publication is misconfigured. Re-check `alter publication supabase_realtime add table public.game_moves` and the migration applied.
- Event arrives but `new` is empty `{}` or missing fields → RLS denied the SELECT. The participant policy `game_moves_select_participants` is wrong. Most likely cause: the `exists ... auth.uid() = g.white_id or g.black_id` check is wrong, or the Realtime worker isn't using the subscriber's JWT. Fix RLS, push migration update, retry.
- Subscription status never reaches `SUBSCRIBED` → Realtime auth/connection issue. Check browser DevTools Network tab for WebSocket errors.

If gate fails, **stop**. Do not proceed to Task 7. Diagnose, fix, retry until gate passes.

### Task 7: GATE — Negative test (non-participant receives nothing)

**Files:** none (manual gate test)

- [ ] **Step 1: Sign up a third test user**

Use a fresh incognito Chrome window (or a different browser). Sign up as `test3@example.com` / password `password123`. Note its user_id from Supabase Studio (call it `USER_C_ID`).

User C is NOT in the `games` row from Task 6 — neither white nor black.

- [ ] **Step 2: Browser 2 — log in as User C, open diagnostic page, subscribe to same GAME_ID**

In the incognito browser → http://localhost:3000/login → `test3@example.com` → navigate to http://localhost:3000/diagnostics/realtime → paste the same `GAME_ID` from Task 6 → "Subscribe".

Expected: `subscription: SUBSCRIBED`. Events list empty.

- [ ] **Step 3: Insert another game_moves row from Studio**

```sql
insert into public.game_moves (game_id, ply, san, uci, fen_after, played_by)
values (
  '<GAME_ID>',
  2,
  'e5',
  'e7e5',
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
  '<USER_B_ID>'
);
```

- [ ] **Step 4: Verify Browser 1 receives, Browser 2 does NOT**

Browser 1 (User A, participant): expected to see a second event with `ply=2`, `san=e5`, `played_by=USER_B_ID`. Full row data in `new`.

Browser 2 (User C, non-participant): expected to see NO new event. Counter remains at 0.

**Gate PASS = Browser 1 sees event with data, Browser 2 sees nothing.**

If Browser 2 receives the event:
- RLS policy on `game_moves_select_participants` is too permissive
- Re-check the policy: it must use `exists` with a join to `games` filtered by `white_id` or `black_id`
- Fix, push migration update, retry both Tasks 6 and 7

### Task 8: Document gate procedure for future regressions

**Files:**
- Create: `wiki/notes/realtime-rls-gate-procedure.md`

- [ ] **Step 1: Write procedure note**

```markdown
# Realtime + RLS Gate Procedure

**Purpose:** Catch the v1 failure mode where Realtime fires events but RLS denies the SELECT, so subscribers receive empty rows. Run this procedure whenever:

- A new RLS policy on a Realtime-published table is added or changed
- The Realtime publication is altered
- Before merging any change that touches `games` or `game_moves` tables

## Procedure (10 minutes)

1. Confirm at least two test users exist in `auth.users` + `profiles` (e.g. `test1@example.com`, `test2@example.com`). Add a third (`test3@example.com`) for the negative-case test.
2. Insert a `games` row in Studio with `white_id = USER_A_ID, black_id = USER_B_ID, status = 'in_progress'`. Note the `id`.
3. Open `/diagnostics/realtime` as User A in Browser 1. Subscribe to the game_id.
4. Insert a `game_moves` row in Studio. Browser 1 should show event with `new` fully populated.
5. Open `/diagnostics/realtime` as User C in Browser 2 (incognito). Subscribe to the same game_id.
6. Insert another `game_moves` row. Browser 1 should receive it; Browser 2 should NOT.

## Fail modes + diagnoses

| Symptom | Diagnosis | Fix |
|---|---|---|
| No event arrives in either browser | Publication misconfigured | `alter publication supabase_realtime add table public.<table>;` |
| Event arrives, `new` is empty `{}` | RLS denies SELECT for the subscriber | Fix RLS policy to allow SELECT for the subscriber's role |
| Subscription status stays `CHANNEL_ERROR` or never reaches `SUBSCRIBED` | Auth or WebSocket issue | Check browser DevTools Network tab; verify env vars; verify session cookie is valid |
| Non-participant subscriber receives event | RLS too permissive | Tighten policy to require participant relationship |

## When to re-run

- After any RLS migration on `games` or `game_moves`
- After any Realtime publication change
- Before any production deploy that touches RLS

## See also

- Phase 3 plan: `docs/superpowers/plans/2026-05-02-v2-phase-3-schema-rls-realtime-gate.md`
- [[mocs/architecture]]
- `app/diagnostics/realtime/` — diagnostic UI used to run the procedure
```

- [ ] **Step 2: Add link to MOC**

Edit `wiki/mocs/architecture.md`. If MOC doesn't yet have a Diagnostics section, add one and link the procedure note. Otherwise just append to its existing list.

- [ ] **Step 3: Commit**

```bash
git add wiki/notes/realtime-rls-gate-procedure.md wiki/mocs/architecture.md
git commit -m "docs: realtime+rls gate procedure note for future regressions"
```

### Task 9: Add Playwright e2e for the gate

**Files:**
- Create: `e2e/realtime-rls-gate.spec.ts`

A regression test that exercises the gate without manual browser work. Runs in CI for any future change to RLS or publication.

- [ ] **Step 1: Write spec**

```typescript
// e2e/realtime-rls-gate.spec.ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// This spec runs against the live Supabase project. CI must have these env vars.
// For local dev, use `bunx playwright test e2e/realtime-rls-gate.spec.ts`.

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY,
  "skipped: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set"
);

test("participant sees Realtime event with row data; non-participant gets silence", async ({
  browser,
}) => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Use existing test users created in Phase 2 manual verification.
  // For CI, ensure they're seeded; otherwise this test is skipped.
  const { data: users } = await admin.auth.admin.listUsers();
  const userA = users.users.find((u) => u.email === "test1@example.com");
  const userB = users.users.find((u) => u.email === "test2@example.com");
  const userC = users.users.find((u) => u.email === "test3@example.com");

  test.skip(!userA || !userB || !userC, "test users not seeded");

  // Create a games row connecting A and B.
  const { data: game } = await admin
    .from("games")
    .insert({
      white_id: userA!.id,
      black_id: userB!.id,
      status: "in_progress",
    })
    .select("id")
    .single();

  expect(game).toBeTruthy();
  const gameId = game!.id;

  // Browser 1: log in as A, open diagnostics, subscribe.
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  // Sign in flow — replace with your project's actual login mechanism.
  // (Phase 4-5 may add a programmatic-login helper. For now, this test is a placeholder
  // that will be filled in once auth helpers exist; until then, run the manual gate.)
  await pageA.goto("/");
  // TODO: programmatic auth helper to be added in Phase 4

  // For now, mark the spec as a documentation reference, not an executable assertion.
  // Once auth helpers exist, replace this skip with the real flow.
  test.fixme(true, "needs programmatic-login helper from Phase 4 to run unattended");

  // Cleanup
  await admin.from("games").delete().eq("id", gameId);
  await ctxA.close();
});
```

(Note: this spec uses `test.fixme` because programmatic auth helpers don't exist until Phase 4. The spec is committed as a placeholder + scaffolding so it's easy to flip on later. The MANUAL gate from Tasks 6+7 is the authoritative pass for Phase 3.)

- [ ] **Step 2: Verify it parses**

```bash
bunx tsc --noEmit
bunx playwright test e2e/realtime-rls-gate.spec.ts
```

Expected: spec runs, marks itself fixme, exits without error.

- [ ] **Step 3: Commit**

```bash
git add e2e/realtime-rls-gate.spec.ts
git commit -m "test: scaffold e2e for realtime+rls gate (fixme until phase 4 auth helper)"
```

### Task 10: Open PR + merge

**Files:** none (PR work)

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/phase-3-schema-rls-realtime
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --base dev --head feat/phase-3-schema-rls-realtime \
  --title "feat: games + game_moves schema + RLS + Realtime gate" \
  --body "$(cat <<'EOF'
## What changed

- Migration `<ts>_init_games.sql`: tables `games` + `game_moves`, RLS policies (SELECT for participants; INSERT/UPDATE deferred to Phase 4 RPC), Realtime publication entries
- Diagnostic UI at `/diagnostics/realtime` (gated to authenticated users) for live RLS+Realtime sanity checks
- Wiki note: gate procedure for future regressions
- Playwright spec scaffold (fixme until Phase 4 auth helper)

## How tested — gate passed

- Manually ran the two-browser positive + negative tests in Tasks 6 and 7 of the plan
- Participant subscriber sees event with full row data
- Non-participant subscriber sees silence
- v1 failure mode (events arriving with empty rows) is NOT present

## Checklist

- [x] CI green locally
- [x] Migration touched? Yes — `supabase db reset` works locally; pushed to remote
- [x] RLS or Realtime touched? Yes — gate procedure passed manually
- [ ] Server Action takes user input? N/A
- [ ] chess.js imported? N/A
EOF
)"
```

- [ ] **Step 3: Wait for CI green**

```bash
gh pr checks
```

- [ ] **Step 4: Merge to dev**

```bash
gh pr merge --merge --delete-branch
git checkout dev
git pull
```

---

## Phase 3 done — verification gate

- [ ] `games` + `game_moves` tables exist with RLS enabled (verified in Studio)
- [ ] `supabase_realtime` publication includes both tables (verified in Studio)
- [ ] Manual gate in Task 6: User A (participant) sees event with full row data — PASS
- [ ] Manual gate in Task 7: User C (non-participant) sees silence — PASS
- [ ] Diagnostic page at `/diagnostics/realtime` accessible only to authenticated users
- [ ] Wiki note `realtime-rls-gate-procedure.md` documents how to re-run
- [ ] Playwright scaffold committed (placeholder until Phase 4)

When all 7 boxes ticked, Phase 3 is shippable. Move to Phase 4 (`docs/superpowers/plans/2026-05-02-v2-phase-4-move-rpc-and-engine.md`).

---

## What's next (Phase 4 preview)

Phase 4 builds:

- `lib/chess/engine.ts` — chess.js wrapper with full unit test suite
- `make_move(p_game_id, p_uci, p_expected_ply)` Postgres RPC with `SECURITY DEFINER` for atomic move append + concurrency check
- `app/games/[gameId]/actions.ts` Server Action calling the RPC after Zod-validating input
- `app/games/[gameId]/page.tsx` minimal board UI scaffold using **mocked** RPC responses for fast UX iteration before RPC is wired
- Programmatic-login Playwright helper (unblocks Phase 3's `e2e/realtime-rls-gate.spec.ts`)
- Negative path: illegal move from curl rejected with chess-rule error message
