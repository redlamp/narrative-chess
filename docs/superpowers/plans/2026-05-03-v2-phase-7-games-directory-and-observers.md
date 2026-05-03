# V2 Phase 7 — Games Directory + Observer Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the `/games` directory page (open / active / completed groups + other-people's open challenges) and the in-match observer counter (current via Supabase Presence + total distinct via a new `game_observers` table).

**Architecture:** A new `public.game_observers` table records distinct authenticated viewers per game, enforced by an idempotent `register_observer(p_game_id)` RPC that the GameClient calls on mount for non-participants. Current "watching now" count comes from a Supabase Realtime presence channel `game:observers:<id>` joined only by spectators (not participants). `<ObserverCount>` shows both numbers in the sidebar. `app/games/page.tsx` runs four parallel queries (my active / my open / my completed / other open) and renders grouped lists with click-through to `/games/<id>`.

**Tech Stack:** Postgres plpgsql, Supabase Realtime Presence, Next.js 16 Server Components + Server Actions, React 19, Zod 4, Bun's built-in test runner, Playwright e2e.

**Spec reference:** `docs/superpowers/specs/2026-05-03-v2-phase-7-games-directory-and-observers-design.md`.

**Prerequisites (M1 must be shipped):** Phases 1–6 on `main`. Phase-5's observer-mode + widened RLS is what makes this phase possible without further policy changes for the directory's other-open query.

**Working branch:** `feat/phase-7-games-directory-observers` off `dev` (already created).

---

## Subagent dispatch guidance

Pick the least powerful model that handles each task. 3 tiers: Mechanical → Haiku, Integration → Sonnet, Architecture/judgment → Opus.

Per-task assignment (11 tasks total, distribution: 2 Haiku, 9 Sonnet, 0 Opus — no architecture-tier task here, the heaviest is the GameClient integration which mirrors patterns from phases 5+6 closely):

| # | Task | Model | Effort | Why |
|---|------|-------|--------|-----|
| 1 | Branch off dev | Haiku | low | git only (already done) |
| 2 | Migration: game_observers + register_observer RPC | Sonnet | standard | plpgsql, RLS, RPC pattern matches phases 4–6 |
| 3 | Schemas: RegisterObserverInputSchema + ObserverPresenceEventSchema + tests | Sonnet | low | Zod, fully specified |
| 4 | Server Action: registerObserver | Sonnet | low | mirrors existing actions |
| 5 | Realtime presence helper + tests | Sonnet | standard | new Supabase API for us; presence channel + auth-before-subscribe pattern |
| 6 | ObserverCount component | Sonnet | low | presentational |
| 7 | GameClient integration | Sonnet | standard | extend mount effects + sidebar layout |
| 8 | Games directory `app/games/page.tsx` | Sonnet | standard | 4 parallel queries + 4 list sections + empty states |
| 9 | E2E: games-directory | Sonnet | standard | Playwright + admin-client fixtures for each state |
| 10 | Verification gate | Haiku | low | runs lint / tsc / playwright / supabase db lint |
| 11 | Open PR feat → dev | Haiku | low | git push + gh pr create |

**Reviewers**: spec-compliance + code-quality reviewers default to **Sonnet, standard effort**. Bump to Opus for any task that returns DONE_WITH_CONCERNS with unresolved correctness issues.

**BLOCKED escalation rule**: first retry escalates one tier (Haiku → Sonnet → Opus). If still blocked at Opus, escalate to the human controller.

---

## File structure

| Path | Responsibility |
|------|----------------|
| `supabase/migrations/<ts>_game_observers.sql` | NEW — table + RLS + register_observer RPC |
| `lib/schemas/game.ts` | extend with `RegisterObserverInputSchema` + `ObserverPresenceEventSchema` |
| `lib/schemas/game.test.ts` | tests for both new schemas |
| `app/games/[gameId]/actions.ts` | extend with `registerObserver` action |
| `lib/realtime/observer-presence.ts` | NEW — presence-channel helper |
| `lib/realtime/observer-presence.test.ts` | NEW — schema parse tests |
| `app/games/[gameId]/ObserverCount.tsx` | NEW — sidebar pill |
| `app/games/[gameId]/GameClient.tsx` | call registerObserver on mount; mount ObserverCount |
| `app/games/page.tsx` | NEW — directory page |
| `e2e/games-directory.spec.ts` | NEW |

---

## Tasks

### Task 1: Branch off dev

**Subagent:** Haiku · low effort

**Files:** none (git only).

- [x] Already done: `feat/phase-7-games-directory-observers` checked out from `dev`.

---

### Task 2: Migration — game_observers table + register_observer RPC

**Subagent:** Sonnet · standard effort

**Files:**
- Create: `supabase/migrations/<ts>_game_observers.sql`

- [ ] **Step 1: Generate the migration**

```bash
supabase migration new game_observers
```

- [ ] **Step 2: Write the migration body**

```sql
-- Phase 7 — game_observers table + register_observer RPC
-- Spec: docs/superpowers/specs/2026-05-03-v2-phase-7-games-directory-and-observers-design.md §4.2-4.3

set check_function_bodies = off;

create table public.game_observers (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

create index game_observers_user_id_idx on public.game_observers (user_id);

comment on table public.game_observers is
  'Distinct authenticated viewers per game. Append-only via register_observer RPC.';

alter table public.game_observers enable row level security;

create policy "game_observers_select_authenticated" on public.game_observers
  for select to authenticated using (true);

create policy "game_observers_insert_own" on public.game_observers
  for insert to authenticated
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- register_observer(p_game_id) returns int
--
-- Idempotent — inserts the (game_id, caller) row if absent and the caller is
-- NOT a participant of the game; returns the current distinct-observer count
-- regardless. Participants who hit the function get the count without being
-- recorded as observers.
-- ----------------------------------------------------------------------------

create or replace function public.register_observer(p_game_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_count int;
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  insert into public.game_observers (game_id, user_id)
  select p_game_id, v_caller
  where not exists (
    select 1 from public.games g
    where g.id = p_game_id
      and (g.white_id = v_caller or g.black_id = v_caller)
  )
  on conflict (game_id, user_id) do nothing;

  select count(*) into v_count
  from public.game_observers
  where game_id = p_game_id;

  return v_count;
end;
$$;

revoke all on function public.register_observer(uuid) from public, anon;
grant execute on function public.register_observer(uuid) to authenticated;

comment on function public.register_observer(uuid) is
  'Records the caller as a distinct observer of the game (no-op if already recorded or if caller is a participant). Returns current observer count.';
```

- [ ] **Step 3: Apply**

```bash
supabase db push
```

- [ ] **Step 4: Smoke (Studio or MCP)**

```sql
-- Without JWT, RPC should raise unauthenticated:
select public.register_observer('00000000-0000-0000-0000-000000000000');
-- Expected: ERROR P0001 unauthenticated
```

```sql
-- Confirm table exists and RLS enabled:
select relname, relrowsecurity from pg_class
where relname = 'game_observers' and relnamespace = 'public'::regnamespace;
-- Expected: 1 row, relrowsecurity=true
```

- [ ] **Step 5: Lint**

```bash
supabase db lint
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/*_game_observers.sql
git commit -m "feat(phase 7): game_observers table + register_observer RPC"
```

---

### Task 3: Schemas — RegisterObserverInput + ObserverPresenceEvent + tests

**Subagent:** Sonnet · low effort

**Files:**
- Modify: `lib/schemas/game.ts`
- Modify: `lib/schemas/game.test.ts`

- [ ] **Step 1: Append to `lib/schemas/game.ts`**

```ts
// (Add to existing file, alongside other exports.)

export const RegisterObserverInputSchema = z.object({
  gameId: z.string().uuid(),
});
export type RegisterObserverInput = z.infer<typeof RegisterObserverInputSchema>;

// Presence-channel state we track per joined client.
export const ObserverPresenceEventSchema = z.object({
  joined_at: z.string(),  // ISO timestamp
});
export type ObserverPresenceEvent = z.infer<typeof ObserverPresenceEventSchema>;
```

(Note on UUID strict: per the phase-3 schema-version note, `lib/schemas/game.ts` uses `z.guid()` for placeholder UUIDs in tests. The new `RegisterObserverInputSchema` uses strict `.uuid()` because real client requests carry RFC-4122 v4 IDs — same pattern as `ResignInputSchema` from phase 6. Use the v4-shaped fixture `"00000000-0000-4000-8000-000000000001"` in the test cases for this schema.)

- [ ] **Step 2: Tests**

Append to `lib/schemas/game.test.ts`:

```ts
describe("RegisterObserverInputSchema", () => {
  test("accepts a v4-shaped uuid", () => {
    expect(
      RegisterObserverInputSchema.safeParse({ gameId: UUID_V4 }).success
    ).toBe(true);
  });
  test("rejects non-uuid", () => {
    expect(
      RegisterObserverInputSchema.safeParse({ gameId: "abc" }).success
    ).toBe(false);
  });
});

describe("ObserverPresenceEventSchema", () => {
  test("accepts a payload with joined_at timestamp", () => {
    expect(
      ObserverPresenceEventSchema.safeParse({
        joined_at: "2026-05-03T12:00:00Z",
      }).success
    ).toBe(true);
  });
  test("rejects missing joined_at", () => {
    expect(ObserverPresenceEventSchema.safeParse({}).success).toBe(false);
  });
});
```

Update the import block at the top of the test file to include `RegisterObserverInputSchema, ObserverPresenceEventSchema`.

- [ ] **Step 3: Run**

```bash
bun test lib/schemas/game.test.ts
```

- [ ] **Step 4: Typecheck + lint**

```bash
bunx tsc --noEmit
bun run lint
```

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/game.ts lib/schemas/game.test.ts
git commit -m "feat(phase 7): zod schemas for register-observer + presence event"
```

---

### Task 4: Server Action — registerObserver

**Subagent:** Sonnet · low effort

**Files:**
- Modify: `app/games/[gameId]/actions.ts`

- [ ] **Step 1: Append the action**

Add to `app/games/[gameId]/actions.ts` (alongside existing actions):

```ts
import { RegisterObserverInputSchema } from "@/lib/schemas/game";

export type RegisterObserverErrorCode =
  | "validation"
  | "unauthenticated"
  | "unknown";

export type RegisterObserverOutcome =
  | { ok: true; count: number }
  | { ok: false; code: RegisterObserverErrorCode; message: string };

export async function registerObserver(
  input: unknown,
): Promise<RegisterObserverOutcome> {
  const parsed = RegisterObserverInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues[0]?.message ?? "invalid input",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: "unauthenticated", message: "not signed in" };
  }

  const { data, error } = await supabase.rpc("register_observer", {
    p_game_id: parsed.data.gameId,
  });
  if (error) {
    return { ok: false, code: "unknown", message: error.message };
  }
  const count = typeof data === "number" ? data : 0;
  return { ok: true, count };
}
```

(Add `RegisterObserverInputSchema` to the existing import from `@/lib/schemas/game`; reuse `createClient` already imported.)

- [ ] **Step 2: Verify**

```bash
bunx tsc --noEmit && bun run lint
```

- [ ] **Step 3: Commit**

```bash
git add app/games/[gameId]/actions.ts
git commit -m "feat(phase 7): server action registerObserver"
```

---

### Task 5: Realtime presence helper + tests

**Subagent:** Sonnet · standard effort

**Files:**
- Create: `lib/realtime/observer-presence.ts`
- Create: `lib/realtime/observer-presence.test.ts`

- [ ] **Step 1: Write `lib/realtime/observer-presence.ts`**

```ts
"use client";

import { createClient } from "@/lib/supabase/client";
import { ObserverPresenceEventSchema } from "@/lib/schemas/game";

const DEV = process.env.NODE_ENV !== "production";

/**
 * Hash userId + gameId to a stable opaque presence key. Avoids leaking
 * raw user_ids to other clients via channel.presenceState().
 *
 * Uses a small synchronous string hash; collision risk between two real
 * users on the same game is astronomically low for our scale (we just
 * want "distinct connections by user, but not user-id-recoverable").
 */
function presenceKey(userId: string, gameId: string): string {
  // FNV-1a over userId + ":" + gameId, hex-encoded.
  const input = `${userId}:${gameId}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ("0000000" + (h >>> 0).toString(16)).slice(-8);
}

export async function joinObserverPresence(
  gameId: string,
  myUserId: string,
  onCount: (count: number) => void,
): Promise<{ leave: () => void }> {
  const supabase = createClient();

  // Realtime auth-before-subscribe per phase 5 lesson.
  const { data } = await supabase.auth.getSession();
  if (data.session) supabase.realtime.setAuth(data.session.access_token);

  const key = presenceKey(myUserId, gameId);
  const channel = supabase.channel(`game:observers:${gameId}`, {
    config: { presence: { key } },
  });

  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState();
    onCount(Object.keys(state).length);
    if (DEV) console.log("[presence] sync, state keys", Object.keys(state).length);
  });

  await channel.subscribe(async (status) => {
    if (DEV) console.log("[presence] status", status);
    if (status === "SUBSCRIBED") {
      const event: { joined_at: string } = {
        joined_at: new Date().toISOString(),
      };
      // Validate our own emit so a schema drift catches early.
      const parsed = ObserverPresenceEventSchema.safeParse(event);
      if (parsed.success) await channel.track(parsed.data);
    }
  });

  return {
    leave: () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    },
  };
}
```

- [ ] **Step 2: Write `lib/realtime/observer-presence.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { ObserverPresenceEventSchema } from "@/lib/schemas/game";

// Pure-schema test only — joinObserverPresence requires a live Supabase
// connection and is exercised in the manual / e2e gate.

describe("ObserverPresenceEventSchema (used by observer-presence)", () => {
  test("accepts presence payloads", () => {
    expect(
      ObserverPresenceEventSchema.safeParse({
        joined_at: new Date().toISOString(),
      }).success,
    ).toBe(true);
  });
  test("rejects garbage", () => {
    expect(ObserverPresenceEventSchema.safeParse({}).success).toBe(false);
    expect(ObserverPresenceEventSchema.safeParse(null).success).toBe(false);
  });
});
```

- [ ] **Step 3: Verify**

```bash
bun test lib/realtime/observer-presence.test.ts
bunx tsc --noEmit
bun run lint
```

- [ ] **Step 4: Commit**

```bash
git add lib/realtime/observer-presence.ts lib/realtime/observer-presence.test.ts
git commit -m "feat(phase 7): observer-presence channel helper with hashed key"
```

---

### Task 6: ObserverCount component

**Subagent:** Sonnet · low effort

**Files:**
- Create: `app/games/[gameId]/ObserverCount.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useState } from "react";
import { joinObserverPresence } from "@/lib/realtime/observer-presence";
import { registerObserver } from "./actions";

type Props = {
  gameId: string;
  myUserId: string;
  isObserver: boolean;
  initialTotal: number; // distinct-observer count from server hydration
};

export function ObserverCount({
  gameId,
  myUserId,
  isObserver,
  initialTotal,
}: Props) {
  const [total, setTotal] = useState(initialTotal);
  const [now, setNow] = useState(0);

  // On mount: if observer, register (idempotent) + refresh total from RPC.
  useEffect(() => {
    if (!isObserver) return;
    void registerObserver({ gameId }).then((r) => {
      if (r.ok) setTotal(r.count);
    });
  }, [gameId, isObserver]);

  // Presence channel — only observers join, so "now" is pure spectator count.
  useEffect(() => {
    if (!isObserver) return;
    let leaver: { leave: () => void } | null = null;
    let cancelled = false;
    void joinObserverPresence(gameId, myUserId, setNow).then((sub) => {
      if (cancelled) sub.leave();
      else leaver = sub;
    });
    return () => {
      cancelled = true;
      leaver?.leave();
    };
  }, [gameId, myUserId, isObserver]);

  // Render even for participants (so they see "X spectators total"); just
  // don't include the participant in the count via the RPC participant-skip.
  if (total === 0 && now === 0) return null;

  return (
    <div className="text-xs text-muted-foreground text-center max-w-xl mx-auto">
      <span aria-label={`${now} watching now, ${total} spectators total`}>
        {now} watching now · {total} spectators total
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
bunx tsc --noEmit && bun run lint
```

- [ ] **Step 3: Commit**

```bash
git add app/games/[gameId]/ObserverCount.tsx
git commit -m "feat(phase 7): ObserverCount component (now + total spectators)"
```

---

### Task 7: GameClient integration — mount ObserverCount + thread initialTotal

**Subagent:** Sonnet · standard effort

**Files:**
- Modify: `app/games/[gameId]/GameClient.tsx`
- Modify: `app/games/[gameId]/page.tsx`

- [ ] **Step 1: Extend `GameClient` props + mount component**

Add to `Props`:

```tsx
initialObserverCount: number;
viewerUserId: string;  // needed for presence key
```

Add seed state isn't needed — the component manages its own.

In the JSX, mount `<ObserverCount>` BELOW the sidebar (between sidebar and GameActions, or below GameActions — tester's preference):

```tsx
import { ObserverCount } from "./ObserverCount";

// ...

<ObserverCount
  gameId={gameId}
  myUserId={viewerUserId}
  isObserver={isObserver}
  initialTotal={initialObserverCount}
/>
```

- [ ] **Step 2: Extend `app/games/[gameId]/page.tsx`**

In the SELECT, add a count subquery for observers:

```ts
const [{ data, error }, observerCountResult] = await Promise.all([
  supabase.from("games").select(`...existing fields...`).eq("id", gameId).single(),
  supabase
    .from("game_observers")
    .select("*", { count: "exact", head: true })
    .eq("game_id", gameId),
]);

// ...

<GameClient
  // ...existing props...
  initialObserverCount={observerCountResult.count ?? 0}
  viewerUserId={user.id}
/>
```

- [ ] **Step 3: Verify**

```bash
bunx tsc --noEmit && bun run lint && bun test
```

- [ ] **Step 4: Commit**

```bash
git add app/games/[gameId]/GameClient.tsx app/games/[gameId]/page.tsx
git commit -m "feat(phase 7): mount ObserverCount in GameClient + hydrate initial total"
```

---

### Task 8: Games directory — `app/games/page.tsx`

**Subagent:** Sonnet · standard effort

**Files:**
- Create: `app/games/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

type GameRow = {
  id: string;
  status: string;
  ply: number;
  white_id: string | null;
  black_id: string | null;
  created_at: string;
  white_name: string | null;
  black_name: string | null;
};

export default async function GamesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/games");

  const uid = user.id;
  const baseSelect = `
    id, status, ply, white_id, black_id, created_at,
    white_name:white_id ( display_name ),
    black_name:black_id ( display_name )
  `;

  const [
    { data: myActiveRaw },
    { data: myOpenRaw },
    { data: otherOpenRaw },
    { data: myCompletedRaw },
  ] = await Promise.all([
    supabase
      .from("games")
      .select(baseSelect)
      .eq("status", "in_progress")
      .or(`white_id.eq.${uid},black_id.eq.${uid}`)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("games")
      .select(baseSelect)
      .eq("status", "open")
      .or(`white_id.eq.${uid},black_id.eq.${uid}`)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("games")
      .select(baseSelect)
      .eq("status", "open")
      .not("white_id", "eq", uid)
      .not("black_id", "eq", uid)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("games")
      .select(baseSelect)
      .in("status", ["white_won", "black_won", "draw", "aborted"])
      .or(`white_id.eq.${uid},black_id.eq.${uid}`)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  function flatten(rows: unknown[] | null): GameRow[] {
    if (!rows) return [];
    return (rows as Array<GameRow & {
      white_name: { display_name: string } | null;
      black_name: { display_name: string } | null;
    }>).map((r) => ({
      ...r,
      white_name: r.white_name?.display_name ?? null,
      black_name: r.black_name?.display_name ?? null,
    }));
  }

  const myActive = flatten(myActiveRaw);
  const myOpen = flatten(myOpenRaw);
  const otherOpen = flatten(otherOpenRaw);
  const myCompleted = flatten(myCompletedRaw);

  return (
    <main className="container mx-auto max-w-4xl py-12 px-6 space-y-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-semibold">Games</h1>
        <Button asChild>
          <Link href="/games/new">Start new game</Link>
        </Button>
      </header>

      <Section title="Your active games" rows={myActive} viewer={uid} emptyHint="No games in progress." />
      <Section title="Your open challenges" rows={myOpen} viewer={uid} emptyHint="None — start one above." />
      <Section title="Other players' open challenges" rows={otherOpen} viewer={uid} emptyHint="No open challenges right now." />
      <Section title="Your completed games" rows={myCompleted} viewer={uid} emptyHint="No completed games yet." />
    </main>
  );
}

function Section({
  title,
  rows,
  viewer,
  emptyHint,
}: {
  title: string;
  rows: GameRow[];
  viewer: string;
  emptyHint: string;
}) {
  return (
    <section>
      <h2 className="text-sm uppercase tracking-wide text-muted-foreground mb-3">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((g) => (
            <li key={g.id}>
              <Link
                href={`/games/${g.id}`}
                className="block rounded border p-3 hover:bg-muted/40 transition-colors"
              >
                <GameRowRender row={g} viewer={viewer} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GameRowRender({ row, viewer }: { row: GameRow; viewer: string }) {
  const youWhite = row.white_id === viewer;
  const youBlack = row.black_id === viewer;
  const opponentName = youWhite
    ? row.black_name ?? "(open)"
    : youBlack
      ? row.white_name ?? "(open)"
      : `${row.white_name ?? "(open)"} vs ${row.black_name ?? "(open)"}`;
  const youColor = youWhite ? "white" : youBlack ? "black" : null;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium truncate">{opponentName}</p>
        <p className="text-xs text-muted-foreground">
          {statusLabel(row.status)} · ply {row.ply}
          {youColor ? ` · you play ${youColor}` : ""}
        </p>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">
        {new Date(row.created_at).toLocaleString()}
      </span>
    </div>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "in_progress": return "In progress";
    case "open": return "Open";
    case "white_won": return "White won";
    case "black_won": return "Black won";
    case "draw": return "Draw";
    case "aborted": return "Aborted";
    default: return status;
  }
}
```

- [ ] **Step 2: Verify**

```bash
bunx tsc --noEmit && bun run lint
```

- [ ] **Step 3: Manual smoke**

`bun run dev` → sign in → navigate to `/games`. Confirm sections render with current data, "Start new game" CTA works.

- [ ] **Step 4: Commit**

```bash
git add app/games/page.tsx
git commit -m "feat(phase 7): /games directory page (4 grouped sections)"
```

---

### Task 9: E2E — games-directory

**Subagent:** Sonnet · standard effort

**Files:**
- Create: `e2e/games-directory.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ensureUser, loginAs } from "./lib/auth-helper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY,
  "skipped: env vars not set",
);

const ALICE = {
  email: "phase7-alice-dir@narrativechess.test",
  password: "phase7-pw-alice-dir",
};
const BOB = {
  email: "phase7-bob-dir@narrativechess.test",
  password: "phase7-pw-bob-dir",
};

test("games directory groups games by state", async ({ browser, baseURL }) => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const aliceUser = await ensureUser(ALICE.email, ALICE.password);
  const bobUser = await ensureUser(BOB.email, BOB.password);

  // Insert one game per state for Alice.
  const startingFen =
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const inserted = await admin
    .from("games")
    .insert([
      {
        white_id: aliceUser.id,
        black_id: bobUser.id,
        status: "in_progress",
        current_fen: startingFen,
        current_turn: "w",
        ply: 0,
      },
      {
        white_id: aliceUser.id,
        black_id: null,
        status: "open",
        current_fen: startingFen,
        current_turn: "w",
        ply: 0,
      },
      {
        white_id: aliceUser.id,
        black_id: bobUser.id,
        status: "white_won",
        termination_reason: "checkmate",
        current_fen: startingFen,
        current_turn: "b",
        ply: 4,
      },
    ])
    .select("id");
  if (inserted.error) throw inserted.error;
  const insertedIds = (inserted.data ?? []).map((r) => r.id);

  // Login Alice + visit /games.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAs(ctx, page, ALICE.email, ALICE.password, baseURL!);
  await page.goto(`${baseURL}/games`);

  await expect(
    page.getByRole("heading", { name: /your active games/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /your open challenges/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /your completed games/i }),
  ).toBeVisible();

  // Each section should have at least one row that's clickable.
  const links = page.locator("a[href^='/games/']");
  expect(await links.count()).toBeGreaterThanOrEqual(3);

  // Cleanup.
  await admin.from("games").delete().in("id", insertedIds);
  await ctx.close();
});
```

- [ ] **Step 2: Run**

```bash
bunx playwright test e2e/games-directory.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/games-directory.spec.ts
git commit -m "test(phase 7): e2e games-directory — groups games by state"
```

---

### Task 10: Verification gate

**Subagent:** Haiku · low effort

- [ ] `bun run lint`
- [ ] `bunx tsc --noEmit`
- [ ] `bun test` — all pass
- [ ] `bunx playwright test` — all pass
- [ ] `supabase db lint` — clean
- [ ] Two-browser manual smoke:
  1. Player A creates game → /games shows it under "Your open challenges".
  2. Player B navigates /games → sees Alice's open challenge under "Other players' open challenges". Clicks → joins.
  3. Both players + a third browser (observer) on the game page → observer count pill shows "1 watching now · 1 spectators total".
  4. Resign → game moves from active to completed in /games.

---

### Task 11: Open PR feat → dev

**Subagent:** Haiku · low effort

```bash
git push -u origin feat/phase-7-games-directory-observers

gh pr create --base dev --head feat/phase-7-games-directory-observers \
  --title "feat: Phase 7 — games directory + observer count" \
  --body "..."
```

After CI green + manual smoke → squash-merge.
