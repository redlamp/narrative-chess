# V2 Phase 7 — Games Directory + Observer Count Design

**Date:** 2026-05-03
**Status:** Draft, pending implementation
**Predecessor phases:** 1–6 shipped; M1 live at https://narrative-chess-70w492vd6-taylor-8571s-projects.vercel.app
**Companion phase:** Phase 8 (landing page + auth header) — separate branch.

## 1. Context

Post-M1, the only path for two players to find a game together is to share the URL out-of-band (Slack / SMS / paste). Observers can watch by URL share but the game itself doesn't communicate that anyone IS observing. Both gaps undercut the "social play" feel Narrative Chess targets.

Phase 7 closes both:

- A `/games` directory page listing the viewer's own games (open / active / completed) plus other people's open challenges, so anyone can find a game without out-of-band coordination.
- An observer count in the active match showing how many people are currently watching plus how many distinct viewers have observed since the game started.

## 2. Goals

- Authenticated users can browse `/games` and see their open challenges, active games, completed games at a glance, plus a "looking for opponents" section listing other players' open challenges.
- During an active game, all participants AND observers see a small "watching" indicator with current count + total distinct count.
- Schema captures distinct viewer identity per game so the total count is meaningful (not just a counter that double-counts on rejoin).
- Existing flows (URL-share, join, play, resign, abort, observe) all keep working unchanged.

## 3. Non-goals

- **Filtering / search** — first cut is grouped lists with implicit limits. If lists grow beyond ~20 per group, revisit.
- **Pagination** — same: trim hard at 20 per group, sort by recency.
- **Notifications** ("someone joined your open challenge") — defer.
- **Observer chat** — defer; observation is read-only.
- **Public observer profile reveal** — count only, no names. (Privacy: the game creator can see WHO joined as a player — that's fine — but observers stay anonymous to participants.)
- **Avatars / display-name editing** — out of scope; uses existing `profiles.display_name`.

## 4. Architecture

### 4.1 Files

| Path | Responsibility |
|------|----------------|
| `supabase/migrations/<ts>_game_observers.sql` | New `public.game_observers` table + RLS + `register_observer(p_game_id)` RPC. |
| `lib/schemas/game.ts` | Add `RegisterObserverInputSchema` + `ObserverPresenceEventSchema`. |
| `app/games/[gameId]/actions.ts` | New `registerObserver(input)` Server Action. |
| `lib/realtime/observer-presence.ts` | Helper that joins a Supabase presence channel `game:observers:<id>` and surfaces current-count + diff events. |
| `app/games/[gameId]/ObserverCount.tsx` | New client component — pill / inline indicator. Mounted in `GameClient`. |
| `app/games/[gameId]/GameClient.tsx` | On mount: call `registerObserver` for non-participants, mount `<ObserverCount>`. |
| `app/games/page.tsx` | NEW server component: lists groups (My active / My open / Other open / My completed). Auth-gated. |
| `e2e/games-directory.spec.ts` | NEW e2e: a user with games in each state sees them grouped correctly. |

### 4.2 `game_observers` table

```sql
create table public.game_observers (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

create index game_observers_user_id_idx on public.game_observers (user_id);

alter table public.game_observers enable row level security;

-- Anyone authenticated can SELECT (so participants + observers + future
-- analytics can read the count). Mirrors the post-phase-5 observer trust
-- model: any authenticated user can see read-only metadata about any game.
create policy "game_observers_select_authenticated" on public.game_observers
  for select to authenticated using (true);

-- Observers can INSERT only their own row (auth.uid() must match user_id).
-- Idempotent on PK conflict — RPC handles the on-conflict logic.
create policy "game_observers_insert_own" on public.game_observers
  for insert to authenticated
  with check (auth.uid() = user_id);

-- No UPDATE / DELETE policies — rows are append-only.
```

Realtime publication: NOT added (we don't need INSERT-event delivery for this table; the count is fetched on demand).

### 4.3 `register_observer` RPC

Called by `<GameClient>` on mount for non-participants. Idempotent — repeated calls return the current row count, no-op on existing row.

```sql
create or replace function public.register_observer(p_game_id uuid)
returns int  -- distinct-observer count after insert
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

  -- Skip the insert if the caller IS a participant — they're not an
  -- observer. The participant case shows up because page.tsx calls this
  -- action for everyone for simplicity; do the participant check here so
  -- the callsite stays single-branch.
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
```

### 4.4 Presence channel for "current watching"

Distinct-viewer total comes from the table. "Currently watching right now" comes from Supabase's Realtime Presence feature on a per-game channel.

Pattern:

```ts
// lib/realtime/observer-presence.ts
"use client";
import { createClient } from "@/lib/supabase/client";

export async function joinObserverPresence(
  gameId: string,
  myUserId: string,
  onCount: (count: number) => void,
): Promise<{ leave: () => void }> {
  const supabase = createClient();
  // Auth must be set on realtime client per phase 5 lesson — same pattern.
  const { data } = await supabase.auth.getSession();
  if (data.session) supabase.realtime.setAuth(data.session.access_token);

  const channel = supabase.channel(`game:observers:${gameId}`, {
    config: { presence: { key: myUserId } },
  });

  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState();
    onCount(Object.keys(state).length);
  });

  await channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({ joined_at: new Date().toISOString() });
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

Presence key = `myUserId` so the count is **distinct connections by user** (a user with two tabs open shows once). Both participants AND observers join the channel; the channel name is `game:observers:<id>` but in practice it's "everyone watching this match" — including the players themselves.

(Privacy note: presence keys default to ephemeral but we send `myUserId`. Other clients can read the presence state via `presenceState()`. Each entry's `key` IS the user_id. Currently this means a participant could enumerate observer IDs — undesirable. Mitigation: hash `myUserId` with the gameId before using as the presence key so the leak is one-way. Trade-off accepted for M1.5; revisit if it becomes an actual privacy concern.)

### 4.5 `<ObserverCount>` component

Renders a small pill at the top of the sidebar (or below the player pills — placement TBD during impl, likely below).

```
"watching: 2 now · 5 total"
```

- "now" = presence-channel count.
- "total" = `game_observers` row count for this game, refreshed on realtime presence-sync events (cheap since the count rarely changes).

Hidden on `status='open'` games (no spectators yet, just one player waiting).

### 4.6 `app/games/page.tsx` directory layout

Server component, auth-gated like every other game route. Fetches four groups in parallel:

```ts
// Pseudocode shape
const [myActive, myOpen, otherOpen, myCompleted] = await Promise.all([
  // status='in_progress', viewer is participant
  supabase.from('games').select(...).eq('status','in_progress')
    .or(`white_id.eq.${uid},black_id.eq.${uid}`).limit(20),

  // status='open', viewer is participant
  supabase.from('games').select(...).eq('status','open')
    .or(`white_id.eq.${uid},black_id.eq.${uid}`).limit(20),

  // status='open', viewer is NOT participant (RLS already permits SELECT)
  supabase.from('games').select(...).eq('status','open')
    .neq('white_id', uid).neq('black_id', uid)  // requires OR-not-eq logic; inline RPC may be cleaner
    .limit(20),

  // terminal statuses, viewer is participant
  supabase.from('games').select(...).in('status', ['white_won','black_won','draw','aborted'])
    .or(`white_id.eq.${uid},black_id.eq.${uid}`).limit(20),
]);
```

Each group rendered as a list with: opponent display_name, status pill, last-move recency (or `created_at`), Click → `/games/<id>`.

Page actions:
- "Start new game" CTA (top-right or empty-state) → `/games/new`.

Empty states:
- No active / no open / no completed → terse message + CTA when relevant.
- "Other open" empty → "Be the first — start an open challenge".

### 4.7 Auth + authorization

| Scenario | Outcome |
|---|---|
| Unauthenticated hits `/games` | Redirect `/login?next=/games`. |
| Authenticated user views `/games` | Sees their own games + other people's open challenges. RLS already permits this query (phase 5 widened SELECT to authenticated for both `games` + `game_moves`). |
| User clicks an "Other open" game | Lands on `/games/<id>` → existing JoinGameForm flow. |
| Observer hits a game URL | `registerObserver` action fires server-side; idempotent on conflict. |

## 5. Error handling

Standard pattern matching phase-4–6:

| Code | Toast / behavior |
|---|---|
| `unauthenticated` | redirect to login |
| `validation` | "Invalid request" |
| `unknown` | "Something went wrong" |

No game-specific failures expected — directory queries return empty arrays on no data, observer registration is idempotent.

## 6. Testing

### 6.1 Unit (Bun)

- `lib/schemas/game.test.ts` — `RegisterObserverInputSchema` + `ObserverPresenceEventSchema`.

### 6.2 E2E (Playwright)

- `e2e/games-directory.spec.ts` — set up a user with one game in each state via admin client, navigate to `/games`, assert each section contains the right entries.
- `e2e/observer-count.spec.ts` (optional) — observer hits URL → `register_observer` row appears → count > 0. Skip if presence flake makes it unreliable; manual smoke covers it.

### 6.3 Verification gate

- `bun run lint`
- `bunx tsc --noEmit`
- `bun test`
- `bunx playwright test`
- `supabase db lint`
- Two-browser manual smoke:
  1. Player A creates a game, observes (in another browser as third user) → opens game URL → sidebar shows "watching: 1 now · 1 total".
  2. Player B joins → presence count goes to 2 (both players are in presence too — wait, design above says players join presence too; reconsider).
  3. Third browser opens URL as observer → "watching: 3 now · 2 total" (observer count is presence; total is observer-table count, which is 2 distinct: observer1 + observer2; player names not in observer table thanks to the participant-skip check in the RPC).

## 7. Risks + open questions

- **Presence-state leak of user_ids** — covered in §4.4 with hash mitigation. Implement at impl time.
- **Players in presence count vs total count** — the design above counts "now" = everyone in the channel (players + observers), but "total" = only distinct observers (RPC skips participants). The labels need to read clearly: "**3 watching now**" (includes players + spectators) vs "**2 spectators total**". Consider phrasing during impl.
  - Cleaner alternative: have players NOT join the presence channel — only observers do. Then "now" reads as pure spectator count. Going with this — players already render as the player pills; presence count is purely spectators.
- **Other-open list too large eventually**: 20-row limit covers near term. If many open games, add pagination.

## 8. Verification gate

Same shape as phase 6's gate.

## 9. References

- Foundation spec: `docs/superpowers/specs/2026-05-02-v2-foundation-design.md`.
- Phase 5 design (observer trust model): `docs/superpowers/specs/2026-05-03-v2-phase-5-board-realtime-design.md`.
- Phase 6 design (RPC patterns): `docs/superpowers/specs/2026-05-03-v2-phase-6-game-end-states-design.md`.
- Realtime auth lesson: `wiki/notes/lesson-realtime-auth-before-subscribe.md`.
