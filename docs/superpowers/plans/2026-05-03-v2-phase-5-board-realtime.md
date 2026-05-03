# V2 Phase 5 — Board UI + Realtime Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the board UI, realtime move sync, and the new-game / join-game flow so two real users in two browsers can sign up, create an open game, share a URL, and play a complete chess game from start to finish.

**Architecture:** Server Components fetch canonical state from `public.games` and dispatch one of three client components based on viewer relationship + game status: `<GameClient>` (active player), `<JoinGameForm>` (non-participant viewing an open game), or `<WaitingForOpponent>` (creator while open). `<GameClient>` mounts `react-chessboard` controlled by local FEN state. Realtime `postgres_changes` subscriptions on `game_moves` (INSERT) and `games` (UPDATE on this row) feed an `applyMove` / `applyStatus` reducer with a ply-monotonic guard, keeping client state race-safe regardless of whether server confirmation or realtime echo arrives first. Two new SECURITY DEFINER RPCs (`create_game`, `join_open_game`) handle game creation and joining with row-locked join races.

**Tech Stack:** Next.js 16 Server Components + Server Actions, React 19, react-chessboard 4.x, sonner (toasts), `@supabase/ssr` server client, `@supabase/supabase-js` browser client, Postgres plpgsql, Zod 4, Bun's built-in test runner, Playwright e2e.

**Spec reference:** `docs/superpowers/specs/2026-05-03-v2-phase-5-board-realtime-design.md`.

**Prerequisites (Phase 4 must be done):** `make_move` RPC, `lib/chess/engine.ts` wrapper, `app/games/[gameId]/actions.ts:makeMove`, `e2e/lib/auth-helper.ts:loginAs` all in place.

**Working branch:** `feat/phase-5-board-realtime` off `dev`.

---

## File structure (this phase creates / modifies)

| Path | Responsibility |
|------|----------------|
| `package.json` | Add `react-chessboard@^4`, `sonner` |
| `app/layout.tsx` | Mount `<Toaster richColors />` once |
| `components/ui/sonner.tsx` | shadcn-installed Toaster wrapper |
| `lib/schemas/game.ts` | Zod: `CreateGameInput`, `JoinGameInput`, `GameRow`, `MoveEvent`, `GameStatusUpdateEvent`. Re-exports `GameStatus` from `move.ts`. |
| `lib/schemas/game.test.ts` | Zod schema unit tests |
| `lib/realtime/subscribe.ts` | `subscribeToMoves(gameId, onMove)` + `subscribeToGameStatus(gameId, onUpdate)` |
| `lib/realtime/subscribe.test.ts` | Schema parse tests for realtime payload shapes |
| `supabase/migrations/<ts>_create_game_and_join_rpc.sql` | `public.create_game` + `public.join_open_game` RPCs |
| `app/games/new/actions.ts` | `'use server'` `createGame(input)` |
| `app/games/new/page.tsx` | Server Component, auth gate, renders `<NewGameForm>` |
| `app/games/new/NewGameForm.tsx` | Client side picker + submit |
| `app/games/[gameId]/actions.ts` | Add `joinGame(input)` next to existing `makeMove` |
| `app/games/[gameId]/page.tsx` | Server Component, fetch + branch |
| `app/games/[gameId]/GameClient.tsx` | Client, `<Chessboard>` + sidebar + realtime |
| `app/games/[gameId]/JoinGameForm.tsx` | Client, "Join as <color>" button |
| `app/games/[gameId]/WaitingForOpponent.tsx` | Client, share URL + `games` UPDATE listener |
| `e2e/multiplayer-untimed.spec.ts` | Two-context happy-path fool's mate |
| `e2e/concurrency-conflict.spec.ts` | Two simultaneous moves at same expected_ply |
| `e2e/join-race.spec.ts` | Two viewers click "Join as black" simultaneously |

---

## Tasks

### Task 1: Branch off dev

**Files:** none (git only).

- [ ] **Step 1: Pull latest dev and branch**

```bash
cd C:/workspace/narrative-chess-v2
git checkout dev
git pull
git checkout -b feat/phase-5-board-realtime
```

Expected: switched to new branch.

---

### Task 2: Install board + toast deps and mount Toaster

**Files:**
- Modify: `package.json` (via `bun add` + `bunx shadcn`)
- Create: `components/ui/sonner.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Install react-chessboard**

```bash
bun add react-chessboard@^4
```

Expected: `react-chessboard` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Install sonner via shadcn (also installs the `sonner` package)**

```bash
bunx shadcn@latest add sonner
```

Expected: `components/ui/sonner.tsx` is created; `sonner` is added to dependencies. If shadcn prompts about overrides, accept defaults.

- [ ] **Step 3: Mount `<Toaster>` in the root layout**

Replace the body in `app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, Raleway, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const interHeading = Inter({ subsets: ["latin"], variable: "--font-heading" });
const raleway = Raleway({ subsets: ["latin"], variable: "--font-sans" });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Narrative Chess",
  description: "Multiplayer chess with a story.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        raleway.variable,
        interHeading.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify build still passes**

```bash
bunx tsc --noEmit
bun run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock components/ui/sonner.tsx app/layout.tsx
git commit -m "feat(phase 5): add react-chessboard + sonner deps and mount Toaster"
```

---

### Task 3: Game schemas + unit tests

**Files:**
- Create: `lib/schemas/game.ts`
- Create: `lib/schemas/game.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/schemas/game.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  CreateGameInputSchema,
  JoinGameInputSchema,
  GameRowSchema,
  MoveEventSchema,
  GameStatusUpdateEventSchema,
} from "./game";

const UUID = "00000000-0000-0000-0000-000000000001";
const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("CreateGameInputSchema", () => {
  test("accepts white", () => {
    const r = CreateGameInputSchema.safeParse({ myColor: "white" });
    expect(r.success).toBe(true);
  });
  test("accepts random", () => {
    const r = CreateGameInputSchema.safeParse({ myColor: "random" });
    expect(r.success).toBe(true);
  });
  test("rejects bogus color", () => {
    const r = CreateGameInputSchema.safeParse({ myColor: "purple" });
    expect(r.success).toBe(false);
  });
});

describe("JoinGameInputSchema", () => {
  test("accepts uuid", () => {
    expect(JoinGameInputSchema.safeParse({ gameId: UUID }).success).toBe(true);
  });
  test("rejects non-uuid", () => {
    expect(JoinGameInputSchema.safeParse({ gameId: "abc" }).success).toBe(false);
  });
});

describe("GameRowSchema", () => {
  test("accepts a fully populated row", () => {
    const r = GameRowSchema.safeParse({
      id: UUID,
      white_id: UUID,
      black_id: UUID,
      current_fen: FEN,
      ply: 0,
      status: "in_progress",
      current_turn: "w",
    });
    expect(r.success).toBe(true);
  });
  test("accepts open with one side null", () => {
    const r = GameRowSchema.safeParse({
      id: UUID,
      white_id: UUID,
      black_id: null,
      current_fen: FEN,
      ply: 0,
      status: "open",
      current_turn: "w",
    });
    expect(r.success).toBe(true);
  });
});

describe("MoveEventSchema", () => {
  test("accepts a postgres_changes payload-shape row", () => {
    const r = MoveEventSchema.safeParse({
      game_id: UUID,
      ply: 1,
      san: "e4",
      uci: "e2e4",
      fen_after: FEN,
      played_by: UUID,
      played_at: "2026-05-03T12:00:00Z",
    });
    expect(r.success).toBe(true);
  });
  test("rejects ply < 0", () => {
    const r = MoveEventSchema.safeParse({
      game_id: UUID,
      ply: -1,
      san: "e4",
      uci: "e2e4",
      fen_after: FEN,
      played_by: UUID,
      played_at: "2026-05-03T12:00:00Z",
    });
    expect(r.success).toBe(false);
  });
});

describe("GameStatusUpdateEventSchema", () => {
  test("accepts shape with new status", () => {
    const r = GameStatusUpdateEventSchema.safeParse({
      id: UUID,
      status: "in_progress",
      white_id: UUID,
      black_id: UUID,
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test lib/schemas/game.test.ts
```

Expected: FAIL with module-not-found for `./game`.

- [ ] **Step 3: Write `lib/schemas/game.ts`**

```ts
import { z } from "zod";
import { GameStatusSchema, type GameStatus } from "./move";

export { GameStatusSchema };
export type { GameStatus };

export const ColorChoiceSchema = z.enum(["white", "black", "random"]);
export type ColorChoice = z.infer<typeof ColorChoiceSchema>;

export const CreateGameInputSchema = z.object({
  myColor: ColorChoiceSchema,
});
export type CreateGameInput = z.infer<typeof CreateGameInputSchema>;

export const JoinGameInputSchema = z.object({
  gameId: z.string().uuid(),
});
export type JoinGameInput = z.infer<typeof JoinGameInputSchema>;

export const GameRowSchema = z.object({
  id: z.string().uuid(),
  white_id: z.string().uuid().nullable(),
  black_id: z.string().uuid().nullable(),
  current_fen: z.string(),
  ply: z.number().int().nonnegative(),
  status: GameStatusSchema,
  current_turn: z.enum(["w", "b"]),
});
export type GameRow = z.infer<typeof GameRowSchema>;

export const MoveEventSchema = z.object({
  game_id: z.string().uuid(),
  ply: z.number().int().nonnegative(),
  san: z.string().min(1),
  uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
  fen_after: z.string(),
  played_by: z.string().uuid(),
  played_at: z.string(),
});
export type MoveEvent = z.infer<typeof MoveEventSchema>;

export const GameStatusUpdateEventSchema = z.object({
  id: z.string().uuid(),
  status: GameStatusSchema,
  white_id: z.string().uuid().nullable(),
  black_id: z.string().uuid().nullable(),
});
export type GameStatusUpdateEvent = z.infer<typeof GameStatusUpdateEventSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun test lib/schemas/game.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Typecheck + lint**

```bash
bunx tsc --noEmit
bun run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/schemas/game.ts lib/schemas/game.test.ts
git commit -m "feat(phase 5): zod schemas for game create/join + realtime payloads"
```

---

### Task 4: Realtime subscribe helper + unit tests

**Files:**
- Create: `lib/realtime/subscribe.ts`
- Create: `lib/realtime/subscribe.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/realtime/subscribe.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  parseMoveEvent,
  parseGameStatusUpdate,
} from "./subscribe";

const UUID = "00000000-0000-0000-0000-000000000001";
const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("parseMoveEvent", () => {
  test("accepts a valid postgres_changes new payload", () => {
    const m = parseMoveEvent({
      game_id: UUID,
      ply: 1,
      san: "e4",
      uci: "e2e4",
      fen_after: FEN,
      played_by: UUID,
      played_at: "2026-05-03T12:00:00Z",
    });
    expect(m).not.toBeNull();
    expect(m!.ply).toBe(1);
  });
  test("returns null on garbage", () => {
    expect(parseMoveEvent({ ply: "not-a-number" })).toBeNull();
    expect(parseMoveEvent(null)).toBeNull();
  });
});

describe("parseGameStatusUpdate", () => {
  test("accepts a valid update", () => {
    const u = parseGameStatusUpdate({
      id: UUID,
      status: "in_progress",
      white_id: UUID,
      black_id: UUID,
    });
    expect(u).not.toBeNull();
    expect(u!.status).toBe("in_progress");
  });
  test("returns null on missing fields", () => {
    expect(parseGameStatusUpdate({ id: UUID })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test lib/realtime/subscribe.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/realtime/subscribe.ts`**

```ts
"use client";

import {
  MoveEventSchema,
  GameStatusUpdateEventSchema,
  type MoveEvent,
  type GameStatusUpdateEvent,
} from "@/lib/schemas/game";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function parseMoveEvent(raw: unknown): MoveEvent | null {
  const r = MoveEventSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export function parseGameStatusUpdate(raw: unknown): GameStatusUpdateEvent | null {
  const r = GameStatusUpdateEventSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export type SubscribeStatus = "idle" | "subscribing" | "subscribed" | "error";

export function subscribeToMoves(
  gameId: string,
  onMove: (m: MoveEvent) => void,
  onStatus?: (s: SubscribeStatus) => void,
): { unsubscribe: () => void } {
  const supabase = createClient();
  onStatus?.("subscribing");
  const channel: RealtimeChannel = supabase
    .channel(`moves:${gameId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "game_moves",
        filter: `game_id=eq.${gameId}`,
      },
      (payload) => {
        const m = parseMoveEvent(payload.new);
        if (m) onMove(m);
        else if (process.env.NODE_ENV !== "production") {
          console.error("subscribeToMoves: dropped malformed payload", payload.new);
        }
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") onStatus?.("subscribed");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onStatus?.("error");
    });

  return {
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
  };
}

export function subscribeToGameStatus(
  gameId: string,
  onUpdate: (u: GameStatusUpdateEvent) => void,
): { unsubscribe: () => void } {
  const supabase = createClient();
  const channel: RealtimeChannel = supabase
    .channel(`game_status:${gameId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "games",
        filter: `id=eq.${gameId}`,
      },
      (payload) => {
        const u = parseGameStatusUpdate(payload.new);
        if (u) onUpdate(u);
        else if (process.env.NODE_ENV !== "production") {
          console.error("subscribeToGameStatus: dropped malformed payload", payload.new);
        }
      },
    )
    .subscribe();

  return {
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun test lib/realtime/subscribe.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Typecheck + lint**

```bash
bunx tsc --noEmit
bun run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/realtime/subscribe.ts lib/realtime/subscribe.test.ts
git commit -m "feat(phase 5): realtime subscribe helpers (moves + status) with zod parse"
```

---

### Task 5: Migration — `create_game` + `join_open_game` RPCs

**Files:**
- Create: `supabase/migrations/<ts>_create_game_and_join_rpc.sql`

- [ ] **Step 1: Generate the migration file**

```bash
supabase migration new create_game_and_join_rpc
```

Expected: a new file at `supabase/migrations/<timestamp>_create_game_and_join_rpc.sql` is created. Note the timestamp.

- [ ] **Step 2: Write the migration body**

Replace the (empty) file content with:

```sql
-- Phase 5 — create_game + join_open_game RPCs
-- Spec: docs/superpowers/specs/2026-05-03-v2-phase-5-board-realtime-design.md §4.2

set check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- create_game(p_my_color text) returns uuid
--
-- Caller becomes white_id or black_id depending on p_my_color. Other side
-- starts null. status='open'. Initial FEN is the standard starting position.
-- Random selection happens in the Server Action, NOT here, because the RPC
-- is intentionally deterministic.
-- ----------------------------------------------------------------------------
create or replace function public.create_game(p_my_color text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_game_id uuid;
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  if p_my_color not in ('white', 'black') then
    raise exception 'invalid_color' using errcode = 'P0001',
      detail = format('expected white|black, got %s', p_my_color);
  end if;

  insert into public.games (
    id,
    white_id,
    black_id,
    current_fen,
    current_turn,
    ply,
    status
  )
  values (
    gen_random_uuid(),
    case when p_my_color = 'white' then v_caller else null end,
    case when p_my_color = 'black' then v_caller else null end,
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'w',
    0,
    'open'
  )
  returning id into v_game_id;

  return v_game_id;
end;
$$;

revoke all on function public.create_game(text) from public, anon;
grant execute on function public.create_game(text) to authenticated;

comment on function public.create_game(text) is
  'Create an open game with caller on the requested side. Other side null until joined.';

-- ----------------------------------------------------------------------------
-- join_open_game(p_game_id uuid) returns public.games
--
-- Atomic claim of the empty side on an open game. Row-locks then performs
-- a single UPDATE; concurrent joiners serialize on the row lock. Loser of
-- the race sees status flipped + already_filled; we enforce that case via
-- the UPDATE's WHERE clause (status='open' AND empty_side IS NULL).
-- ----------------------------------------------------------------------------
create or replace function public.join_open_game(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
  v_caller uuid := auth.uid();
  v_target_side text;
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  select * into g from public.games where id = p_game_id for update;

  if not found then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;

  if g.status <> 'open' then
    raise exception 'not_open' using errcode = 'P0001',
      detail = format('current_status=%s', g.status);
  end if;

  if g.white_id = v_caller or g.black_id = v_caller then
    raise exception 'already_a_participant' using errcode = 'P0001';
  end if;

  if g.white_id is null then
    v_target_side := 'white';
  elsif g.black_id is null then
    v_target_side := 'black';
  else
    raise exception 'already_filled' using errcode = 'P0001';
  end if;

  update public.games
  set
    white_id = case when v_target_side = 'white' then v_caller else white_id end,
    black_id = case when v_target_side = 'black' then v_caller else black_id end,
    status = 'in_progress'
  where id = p_game_id
    and status = 'open'
    and (
      (v_target_side = 'white' and white_id is null)
      or (v_target_side = 'black' and black_id is null)
    )
  returning * into g;

  if not found then
    raise exception 'already_filled' using errcode = 'P0001';
  end if;

  return g;
end;
$$;

revoke all on function public.join_open_game(uuid) from public, anon;
grant execute on function public.join_open_game(uuid) to authenticated;

comment on function public.join_open_game(uuid) is
  'Atomic claim of the empty side on an open game. Row-locks; concurrent joiners serialize.';
```

- [ ] **Step 3: Apply the migration**

```bash
supabase db push
```

Expected: the migration applies cleanly. If you see a hostname / link error, run `supabase link --project-ref <ref>` first per `.claude/memory/tools/supabase-cli-windows.md`.

- [ ] **Step 4: Smoke-check the RPCs in Studio (manual)**

Open Supabase Studio → SQL editor and run:

```sql
-- Should fail with 'unauthenticated' since no JWT in SQL editor:
select public.create_game('white');
```

Expected: error 'unauthenticated' with errcode P0001. This confirms the RPC is reachable and the auth check fires. (We'll use real-user calls via the Server Action to exercise the happy path.)

- [ ] **Step 5: Run the Supabase advisor lint**

```bash
supabase db lint
```

Expected: no new advisors regressed.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/*_create_game_and_join_rpc.sql
git commit -m "feat(phase 5): create_game + join_open_game RPCs (SECURITY DEFINER, row-locked)"
```

---

### Task 6: Server Actions — `createGame` + `joinGame`

**Files:**
- Create: `app/games/new/actions.ts`
- Modify: `app/games/[gameId]/actions.ts` (add `joinGame` next to existing `makeMove`)

- [ ] **Step 1: Write `app/games/new/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateGameInputSchema, type ColorChoice } from "@/lib/schemas/game";

// Note: createGame either throws (via redirect on success) or resolves
// with an error object. There is no { ok: true } branch by design — the
// success path is the redirect, which is a thrown navigation signal that
// Next.js intercepts before it reaches the caller.
export type CreateGameError = {
  ok: false;
  code: "validation" | "unauthenticated" | "unknown";
  message: string;
};

function resolveColor(choice: ColorChoice): "white" | "black" {
  if (choice === "white") return "white";
  if (choice === "black") return "black";
  return Math.random() < 0.5 ? "white" : "black";
}

export async function createGame(input: unknown): Promise<CreateGameError | never> {
  const parsed = CreateGameInputSchema.safeParse(input);
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

  const resolved = resolveColor(parsed.data.myColor);

  const { data, error } = await supabase.rpc("create_game", { p_my_color: resolved });
  if (error) {
    return { ok: false, code: "unknown", message: error.message };
  }

  // RPC returns the new uuid as a scalar; supabase-js wraps it depending on version.
  const gameId = typeof data === "string" ? data : (data as { id?: string } | null)?.id;
  if (!gameId) {
    return { ok: false, code: "unknown", message: "no game id returned" };
  }

  redirect(`/games/${gameId}`);
}
```

Note: `redirect()` throws a Next.js-internal error that the framework intercepts to perform navigation. From the caller's perspective, a successful `createGame` call never resolves to a value — it triggers navigation. The form handler in Task 7 only sees a return value on error paths.

- [ ] **Step 2: Add `joinGame` to `app/games/[gameId]/actions.ts`**

Append the following at the bottom of the existing file (alongside the existing `makeMove` export):

```ts
import { JoinGameInputSchema } from "@/lib/schemas/game";

export type JoinGameErrorCode =
  | "validation"
  | "unauthenticated"
  | "game_not_found"
  | "not_open"
  | "already_a_participant"
  | "already_filled"
  | "unknown";

export type JoinGameOutcome =
  | { ok: true }
  | { ok: false; code: JoinGameErrorCode; message: string };

function mapJoinPgError(msg: string): JoinGameErrorCode {
  if (msg.includes("already_filled")) return "already_filled";
  if (msg.includes("already_a_participant")) return "already_a_participant";
  if (msg.includes("not_open")) return "not_open";
  if (msg.includes("game_not_found")) return "game_not_found";
  if (msg.includes("unauthenticated")) return "unauthenticated";
  return "unknown";
}

export async function joinGame(input: unknown): Promise<JoinGameOutcome> {
  const parsed = JoinGameInputSchema.safeParse(input);
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

  const { error } = await supabase.rpc("join_open_game", { p_game_id: parsed.data.gameId });
  if (error) {
    return { ok: false, code: mapJoinPgError(error.message), message: error.message };
  }

  return { ok: true };
}
```

- [ ] **Step 3: Typecheck + lint**

```bash
bunx tsc --noEmit
bun run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/games/new/actions.ts app/games/[gameId]/actions.ts
git commit -m "feat(phase 5): server actions createGame + joinGame"
```

---

### Task 7: New-game form + page

**Files:**
- Create: `app/games/new/NewGameForm.tsx`
- Create: `app/games/new/page.tsx`

- [ ] **Step 1: Write `app/games/new/NewGameForm.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createGame } from "./actions";
import type { ColorChoice } from "@/lib/schemas/game";

const CHOICES: { value: ColorChoice; label: string }[] = [
  { value: "white", label: "Play as white" },
  { value: "black", label: "Play as black" },
  { value: "random", label: "Random" },
];

export function NewGameForm() {
  const [choice, setChoice] = useState<ColorChoice>("random");
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createGame({ myColor: choice });
      // createGame redirects on success, so we only land here on error.
      if (result && !result.ok) {
        toast.error(result.message);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-md">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Side</legend>
        {CHOICES.map((c) => (
          <div key={c.value} className="flex items-center gap-2">
            <input
              type="radio"
              id={`color-${c.value}`}
              name="myColor"
              value={c.value}
              checked={choice === c.value}
              onChange={() => setChoice(c.value)}
              disabled={pending}
            />
            <Label htmlFor={`color-${c.value}`}>{c.label}</Label>
          </div>
        ))}
      </fieldset>

      <Button type="submit" disabled={pending} size="lg">
        {pending ? "Creating…" : "Create game"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Write `app/games/new/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewGameForm } from "./NewGameForm";

export default async function NewGamePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/games/new");

  return (
    <main className="container mx-auto max-w-3xl py-12 px-6 space-y-6">
      <h1 className="text-2xl font-heading font-semibold">New game</h1>
      <p className="text-sm text-muted-foreground">
        Pick a side and create an open challenge. Share the URL with your opponent.
      </p>
      <NewGameForm />
    </main>
  );
}
```

- [ ] **Step 3: Manual smoke**

```bash
bun run dev
```

Open `http://localhost:3000/games/new` while signed out → expect redirect to `/login?next=/games/new`. Sign in. Return to `/games/new`, pick "white", submit → expect redirect to `/games/<uuid>` (page will 404 until Task 10 lands; that's fine for now). Stop the dev server.

- [ ] **Step 4: Typecheck + lint**

```bash
bunx tsc --noEmit
bun run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/games/new/NewGameForm.tsx app/games/new/page.tsx
git commit -m "feat(phase 5): new-game route + side-picker form"
```

---

### Task 8: GameClient (board + sidebar + realtime)

**Files:**
- Create: `app/games/[gameId]/GameClient.tsx`

This is the largest single component. It owns the live game state, mounts `<Chessboard>`, runs both realtime subscriptions, and renders the minimal sidebar.

- [ ] **Step 1: Write `app/games/[gameId]/GameClient.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Chessboard } from "react-chessboard";
import { toast } from "sonner";
import { Chess } from "chess.js";
import { validateMove } from "@/lib/chess/engine";
import { makeMove } from "./actions";
import {
  subscribeToMoves,
  subscribeToGameStatus,
} from "@/lib/realtime/subscribe";
import type { GameStatus } from "@/lib/schemas/game";

type Props = {
  gameId: string;
  myColor: "w" | "b";
  whiteName: string;
  blackName: string;
  initialFen: string;
  initialPly: number;
  initialStatus: GameStatus;
};

type State = {
  fen: string;
  ply: number;
  status: GameStatus;
  pending: boolean;
};

const TERMINAL: GameStatus[] = ["white_won", "black_won", "draw", "aborted"];

function computeMyTurn(fen: string, myColor: "w" | "b"): boolean {
  try {
    return new Chess(fen).turn() === myColor;
  } catch {
    return false;
  }
}

function statusLabel(status: GameStatus): string {
  switch (status) {
    case "white_won": return "White wins";
    case "black_won": return "Black wins";
    case "draw":      return "Draw";
    case "aborted":   return "Game aborted";
    case "open":      return "Waiting";
    case "in_progress": return "In progress";
  }
}

export function GameClient({
  gameId,
  myColor,
  whiteName,
  blackName,
  initialFen,
  initialPly,
  initialStatus,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>({
    fen: initialFen,
    ply: initialPly,
    status: initialStatus,
    pending: false,
  });

  const applyMoveLocal = useCallback(
    (next: { ply: number; fen: string; status?: GameStatus }) => {
      setState((prev) => {
        if (next.ply <= prev.ply) return prev;
        return {
          ...prev,
          ply: next.ply,
          fen: next.fen,
          status: next.status ?? prev.status,
        };
      });
    },
    [],
  );

  const applyStatusLocal = useCallback((status: GameStatus) => {
    setState((prev) => ({ ...prev, status }));
  }, []);

  // Realtime: opponent's (and our own) move INSERTs.
  useEffect(() => {
    const sub = subscribeToMoves(gameId, (m) => {
      applyMoveLocal({ ply: m.ply, fen: m.fen_after });
    });
    return () => sub.unsubscribe();
  }, [gameId, applyMoveLocal]);

  // Realtime: status flips (open -> in_progress on join; later resign/abort).
  useEffect(() => {
    const sub = subscribeToGameStatus(gameId, (u) => applyStatusLocal(u.status));
    return () => sub.unsubscribe();
  }, [gameId, applyStatusLocal]);

  const myTurn =
    state.status === "in_progress" && !state.pending && computeMyTurn(state.fen, myColor);

  const onPieceDrop = useCallback(
    async (sourceSquare: string, targetSquare: string, piece: string): Promise<boolean> => {
      if (!myTurn) return false;
      if (state.status !== "in_progress") return false;

      // Promotion: react-chessboard 4.x passes a piece string ending in 'q','r','b','n'
      // when promoting; otherwise we infer (default to queen) for pawn-to-last-rank moves.
      const lastChar = piece.charAt(piece.length - 1).toLowerCase();
      const promo =
        ["q", "r", "b", "n"].includes(lastChar) &&
        ((targetSquare.endsWith("8") && piece.startsWith("w") && piece.toLowerCase().endsWith("p")) ||
         (targetSquare.endsWith("1") && piece.startsWith("b") && piece.toLowerCase().endsWith("p")))
          ? lastChar
          : "";
      const uci = `${sourceSquare}${targetSquare}${promo}`;

      // Local pre-validate via the existing engine wrapper. Skip server call
      // on obviously-illegal drops to reduce server load.
      const local = validateMove(state.fen, uci);
      if (!local.ok) return false;

      setState((prev) => ({ ...prev, pending: true }));
      try {
        const result = await makeMove({
          gameId,
          uci,
          expectedPly: state.ply,
        });

        if (result.ok) {
          applyMoveLocal({
            ply: result.data.ply,
            fen: result.data.fen_after,
            status: result.data.status,
          });
          if (TERMINAL.includes(result.data.status)) {
            toast.success(`Game over: ${statusLabel(result.data.status)}`);
          }
          return true;
        }

        switch (result.code) {
          case "concurrency_conflict":
            toast.warning("Position changed — refreshing");
            router.refresh();
            break;
          case "wrong_turn":
            toast.error("Not your turn");
            break;
          case "illegal_move":
            toast.error("Illegal move");
            break;
          case "game_over":
            toast.error("Game already over");
            break;
          case "not_a_participant":
            toast.error("You're not a player in this game");
            break;
          case "not_active":
            toast.error("Game is not active");
            break;
          case "game_not_found":
            toast.error("Game not found");
            break;
          case "unauthenticated":
            toast.error("Sign in again");
            router.push(`/login?next=/games/${gameId}`);
            break;
          case "validation":
            toast.error("Invalid move");
            break;
          default:
            toast.error("Something went wrong — try again");
        }
        return false;
      } catch (e) {
        toast.error("Connection error — try again");
        return false;
      } finally {
        setState((prev) => ({ ...prev, pending: false }));
      }
    },
    [gameId, myTurn, state.fen, state.ply, state.status, applyMoveLocal, router],
  );

  const isWhitesTurn = computeMyTurn(state.fen, "w");
  const turnText =
    state.status !== "in_progress"
      ? statusLabel(state.status)
      : myTurn
        ? "Your turn"
        : "Opponent's turn";

  return (
    <main className="container mx-auto max-w-6xl py-8 px-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
      {/* Test hook — version-agnostic state probe for e2e specs. */}
      <div
        data-testid="game-state"
        data-ply={state.ply}
        data-status={state.status}
        data-fen={state.fen}
        className="sr-only"
      />

      <div className="flex justify-center">
        <div className="w-full max-w-xl aspect-square">
          <Chessboard
            position={state.fen}
            boardOrientation={myColor === "b" ? "black" : "white"}
            onPieceDrop={onPieceDrop}
            arePiecesDraggable={state.status === "in_progress"}
            customBoardStyle={{ borderRadius: 6 }}
          />
        </div>
      </div>

      <aside className="space-y-6">
        <div
          className={
            "rounded border p-4 " +
            (!isWhitesTurn && state.status === "in_progress" ? "border-foreground" : "border-border")
          }
        >
          <p className="text-xs uppercase text-muted-foreground">Black</p>
          <p className="font-medium">{blackName}{myColor === "b" ? " (you)" : ""}</p>
        </div>

        <div className="rounded border border-dashed p-4 text-center">
          <p className="text-sm font-medium">{turnText}</p>
          <p className="text-xs text-muted-foreground mt-1">ply {state.ply}</p>
        </div>

        <div
          className={
            "rounded border p-4 " +
            (isWhitesTurn && state.status === "in_progress" ? "border-foreground" : "border-border")
          }
        >
          <p className="text-xs uppercase text-muted-foreground">White</p>
          <p className="font-medium">{whiteName}{myColor === "w" ? " (you)" : ""}</p>
        </div>
      </aside>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
bunx tsc --noEmit
bun run lint
```

Expected: no errors. If `react-chessboard` types are missing, run `bun add -d @types/react-chessboard` (only if its types aren't bundled).

- [ ] **Step 3: Commit**

```bash
git add app/games/[gameId]/GameClient.tsx
git commit -m "feat(phase 5): GameClient — board, sidebar, realtime sync, race-safe applyMove"
```

---

### Task 9: JoinGameForm + WaitingForOpponent

**Files:**
- Create: `app/games/[gameId]/JoinGameForm.tsx`
- Create: `app/games/[gameId]/WaitingForOpponent.tsx`

- [ ] **Step 1: Write `app/games/[gameId]/JoinGameForm.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { joinGame } from "./actions";

type Props = {
  gameId: string;
  emptySide: "white" | "black";
};

export function JoinGameForm({ gameId, emptySide }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const result = await joinGame({ gameId });
      if (result.ok) {
        router.refresh();
        return;
      }
      switch (result.code) {
        case "already_filled":
          toast.warning("Someone else joined first");
          router.refresh();
          break;
        case "already_a_participant":
          toast.info("You're already in this game");
          router.refresh();
          break;
        case "not_open":
          toast.warning("Game is no longer open");
          router.refresh();
          break;
        case "game_not_found":
          toast.error("Game not found");
          break;
        case "unauthenticated":
          toast.error("Sign in again");
          router.push(`/login?next=/games/${gameId}`);
          break;
        default:
          toast.error("Something went wrong — try again");
      }
    });
  };

  return (
    <main className="container mx-auto max-w-xl py-16 px-6 space-y-6 text-center">
      <h1 className="text-2xl font-heading font-semibold">Join this game?</h1>
      <p className="text-sm text-muted-foreground">
        The {emptySide === "white" ? "white" : "black"} side is open.
      </p>
      <Button size="lg" onClick={onClick} disabled={pending}>
        {pending ? "Joining…" : `Join as ${emptySide}`}
      </Button>
    </main>
  );
}
```

- [ ] **Step 2: Write `app/games/[gameId]/WaitingForOpponent.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { subscribeToGameStatus } from "@/lib/realtime/subscribe";

type Props = {
  gameId: string;
  shareUrl: string;
};

export function WaitingForOpponent({ gameId, shareUrl }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const sub = subscribeToGameStatus(gameId, (u) => {
      if (u.status === "in_progress") {
        toast.success("Opponent joined!");
        router.refresh();
      }
    });
    return () => sub.unsubscribe();
  }, [gameId, router]);

  const onCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="container mx-auto max-w-xl py-16 px-6 space-y-6 text-center">
      <h1 className="text-2xl font-heading font-semibold">Waiting for opponent…</h1>
      <p className="text-sm text-muted-foreground">
        Share this URL. The game starts as soon as someone joins.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded border px-3 py-2 text-xs break-all bg-muted/40">
          {shareUrl}
        </code>
        <Button type="button" onClick={onCopy} variant="outline">
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

```bash
bunx tsc --noEmit
bun run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/games/[gameId]/JoinGameForm.tsx app/games/[gameId]/WaitingForOpponent.tsx
git commit -m "feat(phase 5): join + waiting client components"
```

---

### Task 10: Game route — server component + branching

**Files:**
- Create: `app/games/[gameId]/page.tsx`

- [ ] **Step 1: Write `app/games/[gameId]/page.tsx`**

```tsx
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { GameClient } from "./GameClient";
import { JoinGameForm } from "./JoinGameForm";
import { WaitingForOpponent } from "./WaitingForOpponent";
import { GameStatusSchema } from "@/lib/schemas/game";

const ParamsSchema = z.object({ gameId: z.string().uuid() });

const RowSchema = z.object({
  id: z.string().uuid(),
  white_id: z.string().uuid().nullable(),
  black_id: z.string().uuid().nullable(),
  current_fen: z.string(),
  ply: z.number().int().nonnegative(),
  status: GameStatusSchema,
  current_turn: z.enum(["w", "b"]),
  white_name: z.string().nullable(),
  black_name: z.string().nullable(),
});

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const resolvedParams = await params;
  const parsedParams = ParamsSchema.safeParse(resolvedParams);
  if (!parsedParams.success) notFound();
  const gameId = parsedParams.data.gameId;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/games/${gameId}`);

  const { data, error } = await supabase
    .from("games")
    .select(`
      id,
      white_id,
      black_id,
      current_fen,
      ply,
      status,
      current_turn,
      white_name:white_id ( display_name ),
      black_name:black_id ( display_name )
    `)
    .eq("id", gameId)
    .single();

  if (error || !data) notFound();

  // Supabase JS embed selects come back as { display_name } | null;
  // normalize to flat strings before validating with Zod.
  const flat = {
    ...data,
    white_name: (data as any).white_name?.display_name ?? null,
    black_name: (data as any).black_name?.display_name ?? null,
  };

  const row = RowSchema.parse(flat);

  const viewerIsWhite = row.white_id === user.id;
  const viewerIsBlack = row.black_id === user.id;
  const viewerIsParticipant = viewerIsWhite || viewerIsBlack;
  const emptySide: "white" | "black" | null =
    row.white_id === null ? "white" : row.black_id === null ? "black" : null;

  // Build absolute share URL for the waiting screen.
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const shareUrl = `${proto}://${host}/games/${gameId}`;

  if (row.status === "open" && viewerIsParticipant) {
    return <WaitingForOpponent gameId={gameId} shareUrl={shareUrl} />;
  }
  if (row.status === "open" && !viewerIsParticipant && emptySide) {
    return <JoinGameForm gameId={gameId} emptySide={emptySide} />;
  }
  if (viewerIsParticipant) {
    return (
      <GameClient
        gameId={gameId}
        myColor={viewerIsWhite ? "w" : "b"}
        whiteName={row.white_name ?? "(unknown)"}
        blackName={row.black_name ?? "(unknown)"}
        initialFen={row.current_fen}
        initialPly={row.ply}
        initialStatus={row.status}
      />
    );
  }

  notFound();
}
```

Note on the embed select: Supabase JS treats foreign-key embeds as nested objects. Aliasing `white_name:white_id ( display_name )` walks the FK from `games.white_id → profiles.user_id` and returns `{ display_name }`. The `as any` cast keeps the type-narrowing local; the runtime Zod parse on the flattened object enforces the shape we actually use.

- [ ] **Step 2: Typecheck + lint**

```bash
bunx tsc --noEmit
bun run lint
```

Expected: no errors.

- [ ] **Step 3: Manual two-browser smoke**

```bash
bun run dev
```

- Browser 1 (Alice, signed in): `/games/new` → pick white → submit. Land on `/games/<id>`. Should see `<WaitingForOpponent>` with copy URL.
- Browser 2 (Bob, signed in different account): paste URL. Should see `<JoinGameForm>` "Join as black".
- Bob clicks Join. Alice's tab should auto-flip to `<GameClient>` (via games UPDATE realtime).
- Alice plays e2 → e4 by drag. Bob's board updates within ~1s. Bob plays back. Alice's board updates.
- Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add app/games/[gameId]/page.tsx
git commit -m "feat(phase 5): game route — fetch + auth + branch to GameClient/Join/Waiting"
```

---

### Task 11: E2E — multiplayer-untimed (happy path)

**Files:**
- Create: `e2e/multiplayer-untimed.spec.ts`

- [ ] **Step 1: Write the e2e spec**

```ts
import { expect, test } from "@playwright/test";
import { ensureUser, loginAs } from "./lib/auth-helper";

const ALICE = { email: "phase5-alice@narrativechess.test", password: "phase5-pw-alice" };
const BOB = { email: "phase5-bob@narrativechess.test", password: "phase5-pw-bob" };

test("two browsers — fool's mate over realtime", async ({ browser, baseURL }) => {
  await ensureUser(ALICE.email, ALICE.password);
  await ensureUser(BOB.email, BOB.password);

  const aliceCtx = await browser.newContext();
  const bobCtx = await browser.newContext();
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  await loginAs(aliceCtx, alice, ALICE.email, ALICE.password, baseURL!);
  await loginAs(bobCtx, bob, BOB.email, BOB.password, baseURL!);

  // Alice creates a white-side open game.
  await alice.goto(`${baseURL}/games/new`);
  await alice.locator("#color-white").check();
  await alice.getByRole("button", { name: /create game/i }).click();
  await alice.waitForURL(/\/games\/[0-9a-f-]{36}$/);
  const gameUrl = alice.url();

  // Alice sees the waiting screen.
  await expect(alice.getByRole("heading", { name: /waiting for opponent/i })).toBeVisible();

  // Bob joins as black.
  await bob.goto(gameUrl);
  await bob.getByRole("button", { name: /join as black/i }).click();

  // Both should now see the board.
  await expect(alice.locator("[data-square='e2']")).toBeVisible({ timeout: 10_000 });
  await expect(bob.locator("[data-square='e2']")).toBeVisible({ timeout: 10_000 });

  // Helper to drag a piece by data-square attribute (react-chessboard exposes them).
  async function drag(page: import("@playwright/test").Page, from: string, to: string) {
    const src = page.locator(`[data-square='${from}']`);
    const dst = page.locator(`[data-square='${to}']`);
    await src.dragTo(dst);
  }

  // Helper that waits for both browsers to reach the same ply via the GameClient
  // test hook (version-agnostic — does not depend on react-chessboard's DOM).
  async function waitForPly(
    pages: import("@playwright/test").Page[],
    expectedPly: number,
  ) {
    for (const p of pages) {
      await expect(p.locator("[data-testid='game-state']")).toHaveAttribute(
        "data-ply",
        String(expectedPly),
        { timeout: 5_000 },
      );
    }
  }

  // Fool's mate: 1.f3 e5 2.g4 Qh4#
  await drag(alice, "f2", "f3");
  await waitForPly([alice, bob], 1);

  await drag(bob, "e7", "e5");
  await waitForPly([alice, bob], 2);

  await drag(alice, "g2", "g4");
  await waitForPly([alice, bob], 3);

  await drag(bob, "d8", "h4");
  await waitForPly([alice, bob], 4);

  // Status should be 'black_won' on both sides.
  await expect(alice.locator("[data-testid='game-state']")).toHaveAttribute(
    "data-status",
    "black_won",
    { timeout: 5_000 },
  );
  await expect(bob.locator("[data-testid='game-state']")).toHaveAttribute(
    "data-status",
    "black_won",
    { timeout: 5_000 },
  );
  await expect(alice.getByText(/black wins/i)).toBeVisible();

  await aliceCtx.close();
  await bobCtx.close();
});
```

Notes for the implementer:
- react-chessboard exposes squares with `data-square="e2"` etc. If the actual attribute differs in the installed version, update the selector. Dragging by element-locator with Playwright handles HTML5 DnD natively.
- The `expect(...).toContainText("", ...)` calls are presence checks; if the version emits piece glyphs as `aria-label` text, swap to `expect(locator.getAttribute(...))`.

- [ ] **Step 2: Run the spec**

```bash
bunx playwright test e2e/multiplayer-untimed.spec.ts
```

Expected: pass. If it fails, iterate selectors against a live `bun run dev` session.

- [ ] **Step 3: Commit**

```bash
git add e2e/multiplayer-untimed.spec.ts
git commit -m "test(phase 5): e2e multiplayer-untimed — fool's mate over realtime"
```

---

### Task 12: E2E — concurrency-conflict

**Files:**
- Create: `e2e/concurrency-conflict.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ensureUser } from "./lib/auth-helper";

const ALICE = { email: "phase5-alice-cc@narrativechess.test", password: "phase5-pw-alice-cc" };
const BOB = { email: "phase5-bob-cc@narrativechess.test", password: "phase5-pw-bob-cc" };

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function userClient(email: string, password: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

test("two simultaneous makeMove calls at same expected_ply — one wins", async () => {
  await ensureUser(ALICE.email, ALICE.password);
  await ensureUser(BOB.email, BOB.password);

  // Set up an in-progress game directly in the DB via service role.
  const a = admin();
  const aliceUser = (await a.auth.admin.listUsers()).data.users.find((u) => u.email === ALICE.email)!;
  const bobUser = (await a.auth.admin.listUsers()).data.users.find((u) => u.email === BOB.email)!;

  const { data: created, error: ce } = await a
    .from("games")
    .insert({
      white_id: aliceUser.id,
      black_id: bobUser.id,
      status: "in_progress",
      current_fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      current_turn: "w",
      ply: 0,
    })
    .select("id")
    .single();
  if (ce) throw ce;
  const gameId = created!.id;

  // Two parallel make_move RPC calls from Alice's session at the same ply=0.
  const aliceClient = await userClient(ALICE.email, ALICE.password);
  const [r1, r2] = await Promise.all([
    aliceClient.rpc("make_move", {
      p_game_id: gameId,
      p_uci: "e2e4",
      p_san: "e4",
      p_fen_after: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      p_expected_ply: 0,
      p_terminal_status: null,
    }),
    aliceClient.rpc("make_move", {
      p_game_id: gameId,
      p_uci: "d2d4",
      p_san: "d4",
      p_fen_after: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1",
      p_expected_ply: 0,
      p_terminal_status: null,
    }),
  ]);

  const errs = [r1.error, r2.error].filter(Boolean);
  const oks = [r1.data, r2.data].filter((x) => x !== null && x !== undefined);

  expect(oks.length).toBe(1);
  expect(errs.length).toBe(1);
  expect(errs[0]!.message).toMatch(/concurrency_conflict/);
});
```

- [ ] **Step 2: Run the spec**

```bash
bunx playwright test e2e/concurrency-conflict.spec.ts
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/concurrency-conflict.spec.ts
git commit -m "test(phase 5): e2e concurrency-conflict — two parallel make_move calls"
```

---

### Task 13: E2E — join-race

**Files:**
- Create: `e2e/join-race.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ensureUser } from "./lib/auth-helper";

const ALICE = { email: "phase5-alice-jr@narrativechess.test", password: "phase5-pw-alice-jr" };
const BOB = { email: "phase5-bob-jr@narrativechess.test", password: "phase5-pw-bob-jr" };
const CAROL = { email: "phase5-carol-jr@narrativechess.test", password: "phase5-pw-carol-jr" };

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function userClient(email: string, password: string) {
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

test("two viewers click join simultaneously — one wins, one gets already_filled", async () => {
  await ensureUser(ALICE.email, ALICE.password);
  await ensureUser(BOB.email, BOB.password);
  await ensureUser(CAROL.email, CAROL.password);

  const aliceClient = await userClient(ALICE.email, ALICE.password);
  const { data: gameId, error: ce } = await aliceClient.rpc("create_game", { p_my_color: "white" });
  if (ce) throw ce;

  const bobClient = await userClient(BOB.email, BOB.password);
  const carolClient = await userClient(CAROL.email, CAROL.password);

  const [r1, r2] = await Promise.all([
    bobClient.rpc("join_open_game", { p_game_id: gameId }),
    carolClient.rpc("join_open_game", { p_game_id: gameId }),
  ]);

  const errs = [r1.error, r2.error].filter(Boolean);
  const oks = [r1.data, r2.data].filter((x) => x !== null && x !== undefined);

  expect(oks.length).toBe(1);
  expect(errs.length).toBe(1);
  expect(errs[0]!.message).toMatch(/already_filled/);

  // Verify final state.
  const admin = adminClient();
  const { data: g } = await admin.from("games").select("status, white_id, black_id").eq("id", gameId).single();
  expect(g!.status).toBe("in_progress");
  expect(g!.black_id).not.toBeNull();
});
```

- [ ] **Step 2: Run the spec**

```bash
bunx playwright test e2e/join-race.spec.ts
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/join-race.spec.ts
git commit -m "test(phase 5): e2e join-race — two viewers, row-locked single winner"
```

---

### Task 14: Verification gate

**Files:** none (verification only).

- [ ] **Step 1: Lint**

```bash
bun run lint
```

Expected: no errors.

- [ ] **Step 2: Typecheck**

```bash
bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: All unit tests**

```bash
bun test
```

Expected: all pass — chess engine tests (phase 4), schema tests, subscribe tests.

- [ ] **Step 4: All e2e tests**

```bash
bunx playwright test
```

Expected: all pass — phase 4 specs (illegal-moves, concurrent-moves, realtime-rls-gate) plus phase 5's three new specs.

- [ ] **Step 5: Supabase advisor lint**

```bash
supabase db lint
```

Expected: no new advisors regressed.

- [ ] **Step 6: Two-browser manual smoke**

Run `bun run dev`. With two different signed-in browser contexts:

1. Alice creates white-side open game; sees waiting screen.
2. Bob opens URL in second browser; sees join button; clicks join.
3. Alice's tab flips automatically.
4. Both play any short legal sequence (e2-e4, e7-e5, etc.). Each move appears within ~1s on the other side.

If any step fails, debug and re-run the gate.

---

### Task 15: Open PR `feat/phase-5-board-realtime` → `dev`

**Files:** none (git/GitHub only).

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/phase-5-board-realtime
```

- [ ] **Step 2: Open PR via gh**

```bash
gh pr create --base dev --head feat/phase-5-board-realtime \
  --title "feat: Phase 5 — board UI + realtime sync" \
  --body "$(cat <<'EOF'
## Summary

- New-game route + open-challenge link flow (status='open' game with one side filled, opponent joins via shared URL).
- Game route with server-component branching to `<GameClient>`, `<JoinGameForm>`, or `<WaitingForOpponent>` based on viewer relationship + game status.
- `<GameClient>` mounts react-chessboard + minimal sidebar; subscribes to `game_moves` INSERT (moves) and `games` UPDATE (status). Race-safe `applyMove` uses functional setState with ply-monotonic guard.
- Two new RPCs: `create_game` (deterministic side selection — random resolved in Server Action) and `join_open_game` (row-locked atomic claim).
- Sonner toast plumbing mounted in root layout.

## Test plan

- [ ] `bun run lint`
- [ ] `bunx tsc --noEmit`
- [ ] `bun test`
- [ ] `bunx playwright test`
- [ ] `supabase db lint`
- [ ] Two-browser manual smoke: Alice creates open game; Bob joins via URL; both play a short legal sequence; each move appears within ~1s on the other side.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR opens; CI runs (lint + typecheck + e2e). Wait for green, request review.

- [ ] **Step 3: Merge once green**

After CI passes and the PR is approved, squash-merge to `dev` via the GitHub UI (preserves linear history per project convention).

```bash
git checkout dev
git pull
```

Phase 5 is complete on `dev`. The `dev` → `main` ship merge happens at the end of M1 with phase 6.

---

## Self-review notes

- All spec sections (§4.1–§4.6, §5, §6) map to a task above. §7 verification gate maps to Task 14.
- Every step shows actual code or actual commands; no "TBD" / "implement validation" / "similar to Task N".
- Type names (`GameStatus`, `MoveEvent`, `GameRow`, `JoinGameOutcome`) and method signatures (`createGame`, `joinGame`, `makeMove`, `applyMove`) used in later tasks match earlier definitions.
- One known integration risk left for the implementer: react-chessboard 4.x's exact `onPieceDrop` signature and `data-square` attribute. Both are addressed in the GameClient task with notes; the implementer verifies against the installed version's docs and tweaks if needed.
