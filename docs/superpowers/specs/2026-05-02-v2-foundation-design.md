# V2 Foundation — Design Spec

**Date:** 2026-05-02
**Status:** Drafted (pending user review)
**Supersedes:** `docs/V2_PLAN.md` (kept as historical reference; this doc is the source of truth going forward)
**Author:** Brainstorming session between Taylor + Claude

---

## 1. Context

Narrative Chess v1 grew narrative-first on a fragile chess + multiplayer foundation. Multiplayer never produced a single played move (verified: v1 Supabase project `iwfjbjukqljkrqwibglp` has 3 `game_threads` rows and **0** `game_moves` rows). Persistence drifted across `localStorage` / IndexedDB / files / Supabase. v2 rebuilds chess-first on a sound foundation: two players play a reliable real-time game; narrative layers come after.

The original `docs/V2_PLAN.md` was the starting point. This spec is the result of a full audit of that plan against:

- Current state of the v1 GitHub repo and v1 Supabase project (inspected via Supabase MCP)
- Current Next.js / Supabase / Vercel best practices (May 2026)
- The user's stated goal of an AI-collaboration-friendly repo from day one
- The three-way information split already established (`.claude/memory/` vs `wiki/` vs `docs/`)

## 2. Goals

- **M1**: two real users play an untimed, server-validated game of chess via real-time sync, end on checkmate / stalemate / resign / draw / abort.
- **M1.5**: clocks (live + move-deadline), timeout sweep, reconnect policy.
- **M2+**: narrative layers (cities, characters, story beats) on top of a verified-stable chess core.

## 3. Non-goals (M1)

- Clocks of any kind (deferred M1.5)
- Ratings / Elo (deferred M2)
- Vercel Cron (no timeout sweep without clocks)
- Any narrative / city / character / layout features
- Mobile-first responsive design (desktop-first acceptable for M1)
- OAuth providers (email + password only for M1)

## 4. Locked decisions

| Area | Decision | Rationale |
|---|---|---|
| Stack | Next.js 16.2 + React 19 + TypeScript + Tailwind v4 + shadcn/ui + Zod | Next.js 16.2 ships agent-ready `create-next-app`, browser log forwarding, Server Fast Refresh. See [[decision-stack-nextjs-16]]. |
| Backend | **Fresh** Supabase project. v1 project paused after content export. | v1 schema couples chess to narrative (`game_threads.city_edition_id` FK). RLS history is messy. Only data with real value: 4 city_versions (~133 KB total) — exportable as JSON. See [[decision-fresh-supabase-project]]. |
| Hosting | Vercel Hobby + branch filter (`vercel.json` enables auto-deploy only for `main` + `dev`) | Avoids preview clutter; gives 2 stable URLs. See [[decision-vercel-branch-filter]]. |
| Auth | Email + password (Supabase Auth). OAuth deferred to M2+. | Cheapest happy path. No external provider config. See [[decision-auth-email-password]]. |
| Move append | Postgres RPC `make_move(p_game_id, p_uci, p_expected_ply)` with `SECURITY DEFINER`. Server Action calls RPC. | Single transaction (insert move + update game) and optimistic concurrency check. Server Actions cannot wrap multiple supabase-js calls in a DB transaction. See [[decision-rpc-move-append]]. |
| Profile creation | Postgres trigger on `auth.users` insert auto-creates `public.profiles` row. | Set-and-forget. No app-level race. |
| Local Supabase dev | Hosted-first. Docker deferred until Docker pays off (RLS work, multi-user testing). | Lower activation cost for a semi-technical solo dev. See [[decision-supabase-local-dev]]. |
| ESLint | Keep on (do **not** pass `--no-eslint` to scaffold). | Catches AI-generated mistakes early. v1 already uses ESLint. |
| CI | GitHub Actions: `lint`, `typecheck`, `playwright test` on every PR. Required status checks on `main` and `dev`. | Keep broken code out of `dev`/`main`. |
| Branch policy | `feat/*` off `dev`, PR to `dev`. `dev` → `main` via PR (CI green required, linear history). | Solo dev with Claude as collaborator; self-merge OK. |
| v1 visibility | Keep public until v2 M1 ships, privatize after | Preserves v1 GH Pages during transition. |
| Bun version | Pinned via `package.json#packageManager` field | Avoids drift. CI uses same version. |

## 5. M1 scope — what the user can do

### In M1

- Sign up + log in with email + password.
- Create a game (open or by invite link).
- Join a game from open list or by URL.
- Play moves via **drag-and-drop** on the board (click-to-move can be added M1.5 as a11y fallback).
- See opponent's moves arrive in real time (Supabase Realtime).
- Server rejects illegal moves; client shows error toast.
- Game ends correctly on: checkmate, stalemate, resign, abort (before move 1), draw by 3-fold repetition / 50-move / insufficient material.
- Two-browser e2e smoke test passes.

### Out of M1

- Clocks (M1.5)
- Ratings / Elo (M2)
- Click-to-move accessibility fallback (M1.5)
- Mobile-responsive board (M2+)
- All narrative / city / character / layout features (M2+)
- OAuth providers (M2+)
- Local Supabase via Docker (deferred; trigger condition documented)

## 6. Architecture

### 6.1. Data model

Three core tables (plus `auth.users` managed by Supabase):

```sql
-- public.profiles — app-level user data, mirror of auth.users
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Trigger to auto-create profile on signup
create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- public.games — one row per game; current_fen + ply cached for O(1) move append
create table games (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  white_id uuid references profiles(user_id),
  black_id uuid references profiles(user_id),
  status text not null check (status in ('open','in_progress','white_won','black_won','draw','aborted')),
  current_fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  current_turn text not null default 'w' check (current_turn in ('w','b')),
  ply integer not null default 0
);

-- public.game_moves — append-only ledger
create table game_moves (
  game_id uuid references games(id) on delete cascade,
  ply integer not null,
  san text not null,
  uci text not null,
  fen_after text not null,
  played_by uuid not null references profiles(user_id),
  played_at timestamptz not null default now(),
  primary key (game_id, ply)
);

-- Realtime publications
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table game_moves;
```

### 6.2. RLS policies

Both `games` and `game_moves`: **SELECT** allowed for participants; **INSERT/UPDATE** allowed only via the RPC (which runs `SECURITY DEFINER`, bypassing RLS).

```sql
alter table games enable row level security;
alter table game_moves enable row level security;
alter table profiles enable row level security;

-- Participants can SELECT their own games
create policy "games_select_participants" on games for select
  using (auth.uid() = white_id or auth.uid() = black_id or status = 'open');

-- Participants can SELECT moves in their own games
create policy "moves_select_participants" on game_moves for select
  using (exists (
    select 1 from games g where g.id = game_moves.game_id
      and (auth.uid() = g.white_id or auth.uid() = g.black_id)
  ));

-- Profiles: anyone signed-in can SELECT (needed for showing opponent's display name)
create policy "profiles_select_authenticated" on profiles for select to authenticated using (true);
create policy "profiles_update_own" on profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

**Critical**: before writing any board UI, run a two-browser sanity check that confirms Realtime fires AND the subscriber's RLS allows SELECT of the new row. v1's failure mode was Realtime firing with subscribers seeing nothing because RLS denied the SELECT.

### 6.3. Move append RPC

```sql
create function public.make_move(
  p_game_id uuid,
  p_uci text,
  p_expected_ply int
) returns games
language plpgsql security definer set search_path = public as $$
declare
  g games%rowtype;
  -- ... validation logic uses chess.js wrapper or a Postgres-side validator
begin
  select * into g from games where id = p_game_id for update;
  if g.ply <> p_expected_ply then
    raise exception 'concurrency_conflict' using errcode = 'P0001';
  end if;
  -- validate move legality, compute fen_after, update game state, insert move
  -- terminal states (checkmate/stalemate/draw) update games.status accordingly
  return g;
end;
$$;

revoke all on function public.make_move from public;
grant execute on function public.make_move to authenticated;
```

Server Action wraps the RPC call:

```ts
// app/games/[gameId]/actions.ts
"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const MoveInput = z.object({
  gameId: z.string().uuid(),
  uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
  expectedPly: z.number().int().nonnegative(),
});

export async function makeMove(raw: unknown) {
  const input = MoveInput.parse(raw);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("make_move", {
    p_game_id: input.gameId,
    p_uci: input.uci,
    p_expected_ply: input.expectedPly,
  });
  if (error) throw error;
  return data;
}
```

Note on chess engine choice inside the RPC: chess.js is JS-only. Two implementation options:

- **A.** Validate in Server Action (chess.js), then RPC trusts and persists. Fast, but server-side validation lives outside the DB. RLS still gates access.
- **B.** Implement minimal move-legality check in `plpgsql` inside the RPC. Full chess rules (en passant, castling) are non-trivial. Overkill for M1.

**M1 takes A.** Trust boundary: the Server Action is the chess validator. The RPC is the persistence + concurrency boundary. The `expected_ply` check prevents both racing clients and replay attacks. Document this in CLAUDE.md as a deliberate trade.

### 6.4. Realtime sync

```ts
// lib/realtime/subscribe.ts
import { z } from "zod";

const MoveEvent = z.object({
  game_id: z.string().uuid(),
  ply: z.number().int(),
  san: z.string(),
  uci: z.string(),
  fen_after: z.string(),
  played_by: z.string().uuid(),
  played_at: z.string(),
});

export function subscribeToMoves(gameId: string, onMove: (m: z.infer<typeof MoveEvent>) => void) {
  const supabase = /* browser client */;
  return supabase
    .channel(`moves:${gameId}`)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "game_moves", filter: `game_id=eq.${gameId}` },
      (payload) => onMove(MoveEvent.parse(payload.new)))
    .subscribe();
}
```

A `games` channel mirrors the same pattern for status changes (checkmate, resign, abort).

### 6.5. Repo layout

See `wiki/projects/narrative-chess-v2.md` Status section for current state. Final target layout:

```
narrative-chess-v2/
  app/
    (auth)/login/page.tsx, sign-up/page.tsx
    games/page.tsx, new/page.tsx, [gameId]/{page.tsx, actions.ts}
    layout.tsx, page.tsx
  components/{ui, board, game}/
  lib/
    supabase/{client, server, middleware}.ts
    chess/{engine.ts, engine.test.ts}      # chess.js wrapper, sole import site
    realtime/subscribe.ts
    schemas/                               # Zod schemas
  middleware.ts                            # auth session refresh
  supabase/{config.toml, migrations/, seed.sql}
  e2e/{multiplayer-untimed, illegal-moves, resign}.spec.ts
  content/v1-narrative-archive/            # cities/editions/versions JSON dump
  .claude/memory/                          # AI auto-context (already exists)
  wiki/                                    # Obsidian vault (already exists)
  docs/{V2_PLAN.md, superpowers/specs/, decisions/, runbooks/}
  .github/{workflows/ci.yml, pull_request_template.md}
  .husky/pre-commit                        # or simple-git-hooks
  vercel.json                              # branch filter
  package.json                             # packageManager pinned
  CLAUDE.md, AGENTS.md, .mcp.json
  .env.local.example
  README.md
```

## 7. Step sequence (revised, replaces V2_PLAN steps)

### Step A — Settle v1 working tree

- v1 remote: `redlamp/narrative-chess-v1` (renamed, still public until v2 M1 ships per §4).
- Local v1 working tree: clean, **1 commit ahead of origin** (`58c6eca feat(ui): hide sign-in button + non-Historic Games tabs`).
- **Action:** push that commit.

```bash
cd C:/workspace/narrative-chess-v1
git push origin main
```

### Step B — Local v2 already initialized

- `C:/workspace/narrative-chess-v2` exists with `dev` and `main` at `d28c342 chore: initial scaffolding — memory, wiki, conventions`.
- Repo not yet on GitHub remote.
- Memory + wiki + CLAUDE.md infrastructure in place.

**Action:** none yet for this step; covered by step C.

### Step C — Create fresh GitHub repo + connect remote

```bash
cd C:/workspace/narrative-chess-v2
gh repo create redlamp/narrative-chess --public \
  --description "Chess-first multiplayer game with narrative layer (v2 rebuild)" \
  --source . --remote origin
git push -u origin main
git push -u origin dev
```

Verify: `gh repo view redlamp/narrative-chess` shows fresh repo, both branches present.

### Step D — Scaffold Next.js + dependencies

```bash
cd C:/workspace/narrative-chess-v2
bun create next-app@latest . --ts --tailwind --app --import-alias="@/*" --no-src-dir --use-bun
bunx shadcn@latest init
bun add @supabase/supabase-js @supabase/ssr chess.js zod
bun add -d @playwright/test
```

**Caveat:** `create-next-app` may refuse to scaffold into a non-empty directory or warn about conflicts with existing `CLAUDE.md`, `.gitignore`, `.git`. Two safe paths:

- **A.** Scaffold to a sibling temp folder (e.g., `C:/workspace/_v2-scaffold`), then `cp -r _v2-scaffold/* narrative-chess-v2/` excluding `.git`, then resolve conflicts on `.gitignore` and `README.md` by hand.
- **B.** Move existing repo contents (`.claude/`, `wiki/`, `docs/`, `CLAUDE.md`, `.git/`) into a temp dir, run scaffold, then move conventions back in.

Either is ~10 minutes. Pick A; it preserves `.git` history without interruption.

Pin Bun in `package.json#packageManager`. Commit on a `feat/scaffold-next` branch off `dev`.

### Step E — Repo conventions wired

Before any feature work:

- `vercel.json` with `git.deploymentEnabled.main = true`, `git.deploymentEnabled.dev = true`
- `.github/workflows/ci.yml` running `bun lint`, `bun typecheck`, `bunx playwright test`
- Branch protection on `main` + `dev`: require CI green; require linear history on `main`; forbid force-push on both.
- `.github/pull_request_template.md` with checklist (migrations? RLS? Realtime?)
- `.husky/pre-commit` (or simple-git-hooks) running lint + typecheck on staged files
- `.mcp.json` carrying Supabase MCP from v1
- `README.md` minimal: how to run dev, link to CLAUDE.md
- AGENTS.md as stub pointing to CLAUDE.md
- Append AI-rails section to existing CLAUDE.md (file invariants, knowledge cutoff caveat, what-not-to-touch)

Verify: a junk PR triggers CI and gets blocked on red.

### Step F — Vercel hookup

1. `vercel.com` → "Add New Project" → import `redlamp/narrative-chess` → grant repo access via GitHub OAuth.
2. `cd narrative-chess-v2 && vercel link` (associates local folder).
3. Add env vars in Vercel dashboard with correct scopes (Production + Preview only for service_role; all three for public keys). See spec §3.
4. Verify: push to `dev` deploys to `dev.narrative-chess.vercel.app`; push to feat branch does **not** deploy.
5. Custom alias: `dev.narrative-chess.vercel.app` → `dev` branch via Vercel dashboard.

### Step G — Export v1 narrative content

Before creating new Supabase project (so v1 project is fresh in mind and active):

```sql
-- via Supabase MCP execute_sql or psql
copy (select row_to_json(c) from cities c) to '/tmp/cities.json';
copy (select row_to_json(ce) from city_editions ce) to '/tmp/editions.json';
copy (select row_to_json(cv) from city_versions cv) to '/tmp/versions.json';
```

Or simpler: pull via MCP `execute_sql` and write to `content/v1-narrative-archive/{cities,editions,versions}.json`. Commit on `feat/v1-content-export`.

After export verified: pause v1 Supabase project (Settings → Pause project) to prevent accidental reuse.

### Step H — Fresh Supabase project + auth shell

1. Create new project `narrative-chess-v2` in Supabase dashboard (eu-central-1 to match v1 latency profile).
2. `supabase login`, `supabase init`, `supabase link --project-ref <new-ref>`.
3. Migration `0001_init_profiles.sql` — `profiles` table + handle_new_user trigger.
4. `supabase db push`.
5. Wire `@supabase/ssr` cookie pattern: `lib/supabase/{client,server,middleware}.ts` + root `middleware.ts`.
6. Login + signup pages.
7. Verify: signup → profile row exists in DB → refresh keeps session → second tab session works.

### Step I — Schema + RLS + Realtime, gated on verification

1. Migration `0002_init_games.sql` — `games`, `game_moves`, RLS policies, Realtime publications (per §6.1, §6.2).
2. **Gate**: two-browser RLS+Realtime sanity test BEFORE any UI work. Open two browsers as two users; User A subscribes to `game_moves` via console snippet; User B inserts via temp test path; confirm A receives the event. Fix any silent failure before §6.3.

### Step J — Move RPC + Server Action

Migration `0003_make_move_rpc.sql`. Server Action at `app/games/[gameId]/actions.ts`. Unit tests for `lib/chess/engine.ts`. End-state: server rejects illegal moves; legal moves persist + broadcast.

### Step K — Board UI + Realtime sync

Board component with drag-and-drop. Realtime subscription updates local state on incoming moves. Toast on Server Action error.

### Step L — Game end states + resign

Server-side detection of checkmate / stalemate / 3-fold / 50-move / insufficient material. `resign(gameId)` Server Action. Abort allowed only before move 1.

### Step M — e2e + ship M1

- `e2e/multiplayer-untimed.spec.ts`: two contexts, fool's mate happy path.
- `e2e/illegal-moves.spec.ts`: illegal-move attempts rejected.
- `e2e/resign.spec.ts`: resign flow.
- All green → merge `dev` → `main` → Vercel deploys production.

### Step N — Privatize v1 (post-ship)

After M1 verified in production:

```bash
gh repo edit redlamp/narrative-chess-v1 --visibility private --accept-visibility-change-consequences
```

GH Pages goes offline (acceptable — v1 archived as historical reference).

## 8. AI rails

### CLAUDE.md additions

Append to existing project `CLAUDE.md`:

- **Stack pin**: Next.js 16.2, React 19, TS, Tailwind v4, shadcn, Supabase, chess.js, Zod.
- **Knowledge cutoff caveat**: training is older than this stack. Verify Next.js / Supabase syntax against current docs (WebFetch) before introducing patterns not already in repo.
- **File invariants**:
  - DB writes only via Server Actions. Client never imports `service_role`.
  - Migrations only via `supabase migration new <name>`. Never edit a pushed migration.
  - chess.js imported only in `lib/chess/engine.ts`. Wrap, never spread.
  - RLS policies live in same migration as the table they guard.
- **What NOT to touch**: `node_modules/`, past migrations, `auth.users` directly.
- **Verification commands**: `bun lint`, `bun typecheck`, `bunx playwright test`.
- **Pulling content from v1**: clone `redlamp/narrative-chess-v1` separately; copy by hand; never auto-import.

### `.mcp.json`

Carry Supabase MCP entry from v1. Future Claude sessions inspect schema + run safe queries through MCP rather than guessing.

### PR template

`.github/pull_request_template.md`:

- What changed
- How tested
- [ ] Migration touched? If yes, ran `supabase db reset` locally (or accept hosted-only risk)
- [ ] RLS or Realtime touched? If yes, two-browser sanity test passed

### ADRs

Significant decisions captured in `wiki/notes/decision-*.md` per wiki conventions. Cross-linked from `wiki/mocs/decisions.md`. Long-form ADRs at `docs/decisions/` only when wiki-note format is too cramped.

## 9. Risks (residual)

| Risk | Mitigation |
|---|---|
| Next.js 16.2 post-dates Claude's training (Jan 2026) | WebFetch docs before novel patterns. CLAUDE.md mandates check. |
| Realtime+RLS could trip on later RLS edits | CI gate: a "subscriber sees insert" smoke test that breaks the build if RLS regresses |
| chess.js draw detection (3-fold / 50-move) — server trusts library | Unit tests with known position sequences for each draw type |
| Supabase free tier pauses after 7 days idle | Documented; not a bug |
| Drag-drop without click-to-move = mouse-only | Ship drag-drop M1; add click-to-move M1.5 |
| Hosted-only dev = early RLS mistakes hit prod | Mitigated by 2 test users, low data volume. Trigger to install Docker: first incident. |
| v1 Supabase project still active during transition | Pause it after content export |
| Bun version drift on collaborator machine | `packageManager` pin + CI matches |

## 10. Verification gates (per step)

- **Step C**: GitHub repo visible, branches pushed.
- **Step E**: junk PR with intentionally-broken code is blocked by CI.
- **Step F**: push to `dev` deploys to `dev.narrative-chess.vercel.app`; push to feat branch does NOT auto-deploy.
- **Step G**: `content/v1-narrative-archive/*.json` committed; v1 project paused.
- **Step H**: signup creates `auth.users` + `profiles` rows; refresh keeps session; second tab session works.
- **Step I (CRITICAL GATE)**: two-browser Realtime+RLS sanity test passes BEFORE any UI work.
- **Step J**: illegal move from Postman / curl is rejected with chess-rule error; legal move persists + broadcasts.
- **Step K**: drag-drop works in Chrome desktop; opponent's move appears live on second browser.
- **Step L**: each terminal state (checkmate, stalemate, resign, abort) lands `games.status` correctly.
- **Step M**: all three e2e specs green in CI.
- **Step N**: `gh repo view redlamp/narrative-chess-v1` shows private; production v2 still working.

## 11. References

- Original plan: `docs/V2_PLAN.md`
- Wiki decisions:
  - [[decision-stack-nextjs-16]]
  - [[decision-fresh-supabase-project]]
  - [[decision-rpc-move-append]]
  - [[decision-supabase-local-dev]]
  - [[decision-vercel-branch-filter]]
  - [[decision-auth-email-password]]
- Conventions: `wiki/CLAUDE.md`, project `CLAUDE.md`
- v1 repo: `redlamp/narrative-chess-v1` (https://github.com/redlamp/narrative-chess-v1)
- v1 Supabase project: `iwfjbjukqljkrqwibglp` (paused after step G)
- Next.js 16.2 release: https://nextjs.org/blog/next-16-2
