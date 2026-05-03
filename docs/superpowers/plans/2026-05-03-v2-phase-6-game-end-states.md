# V2 Phase 6 — Game End States + Resign / Abort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add resign + abort actions, the terminal-state banner UI, and the database `termination_reason` field so a finished game communicates its result clearly. After phase 6, M1 ships `dev` → `main`.

**Architecture:** Two new SECURITY DEFINER RPCs (`resign`, `abort_game`) flip `games.status` + populate a new `games.termination_reason` column. Make_move RPC extended to populate the same column on chess-engine terminal moves. `<GameActions>` renders the resign / abort buttons in the sidebar gated by ply + status; clicks open a shadcn AlertDialog confirm. `<TerminalBanner>` renders above the board when status is terminal, showing winner + reason + "Start new game" CTA. Realtime status updates already flow via `subscribeToGameStatus` from phase 5; the schema for that payload extends to include `termination_reason`.

**Tech Stack:** Postgres plpgsql, Next.js 16 Server Components + Server Actions, React 19, shadcn/ui (alert-dialog newly added), `@supabase/ssr`, `@supabase/supabase-js`, Zod 4, Bun's built-in test runner, Playwright e2e.

**Spec reference:** `docs/superpowers/specs/2026-05-03-v2-phase-6-game-end-states-design.md`.

**Prerequisites (Phase 5 must be done):** PR #8, #9, #10 all merged to `dev`. `<GameClient>` mounts board + sidebar + realtime; `subscribeToGameStatus` exists; observer mode lives.

**Working branch:** `feat/phase-6-game-end-states` off `dev`.

---

## Subagent dispatch guidance

Per `superpowers:subagent-driven-development` SKILL.md §"Model Selection", pick the least powerful model that handles each role:

- **Mechanical** (1–2 files, fully specified) → Haiku.
- **Integration** (multi-file coordination, library wiring) → Sonnet.
- **Architecture / judgment** (race-safety, library API verification) → Opus.

**Effort tiering**: low for mechanics, standard for typical implementation, high only when correctness needs deeper reasoning, max only after a BLOCKED retry.

Per-task assignment for phase 6 (14 tasks total, distribution: 6 Haiku, 7 Sonnet, 1 Opus):

| # | Task | Model | Effort | Why |
|---|------|-------|--------|-----|
| 1  | Branch off dev | Haiku | low | git only |
| 2  | Migration: termination_reason col + resign + abort RPCs + make_move extension | Sonnet | standard | plpgsql with row-locking + auth checks + UPDATE existing function |
| 3  | Schemas: ResignInput + AbortInput + extended GameStatusUpdateEvent + tests | Sonnet | low | Zod additions, fully specified |
| 4  | Server Actions: resign + abortGame | Sonnet | standard | Zod + RPC + error mapping |
| 5  | Install shadcn alert-dialog | Haiku | low | one CLI invocation |
| 6  | GameActions component | Sonnet | standard | client form, dialog, conditional gating |
| 7  | TerminalBanner component | Sonnet | low | presentational, well-specified |
| 8  | GameClient integration | **Opus** | **high** | extend state shape + realtime payload + banner mount + edge cases (game ended while drag-pending, etc.) |
| 9  | page.tsx: select termination_reason + pass through | Sonnet | low | Zod row schema extension + prop addition |
| 10 | E2E: resign flow | Sonnet | standard | Playwright + RPC + realtime assert |
| 11 | E2E: abort flow | Sonnet | standard | Playwright + two scenarios (ply=0 ok, ply=1 reject) |
| 12 | Extend multiplayer-untimed.spec.ts: banner assert | Haiku | low | one-line assertion add |
| 13 | Verification gate | Haiku | low | runs lint / tsc / playwright / supabase db lint |
| 14 | Open PR feat → dev | Haiku | low | git push + `gh pr create` |

**Spec/code review subagents** (the second-stage reviewers): default to **Sonnet, standard effort**. Bump to Opus for the GameClient task (Task 8).

**Final implementation reviewer** (after all 14 tasks): **Opus**, standard effort.

**BLOCKED escalation rule**: first retry escalates one tier (Haiku → Sonnet → Opus). If still blocked at Opus, escalate to the human controller.

---

## File structure (this phase creates / modifies)

| Path | Responsibility |
|------|----------------|
| `supabase/migrations/<ts>_resign_and_abort_rpcs.sql` | Add `termination_reason` col + `public.resign` + `public.abort_game` RPCs + extend make_move to populate `termination_reason`. |
| `lib/schemas/game.ts` | Add `ResignInputSchema`, `AbortInputSchema`, `TerminationReasonSchema`; extend `GameStatusUpdateEventSchema` with optional `termination_reason`. |
| `lib/schemas/game.test.ts` | Tests for the new schemas. |
| `app/games/[gameId]/actions.ts` | Add `resign` + `abortGame` Server Actions next to existing `makeMove` + `joinGame`. |
| `app/games/[gameId]/GameActions.tsx` | NEW: client component, resign + abort buttons + confirm dialog. |
| `app/games/[gameId]/TerminalBanner.tsx` | NEW: client component, the inline result banner. |
| `app/games/[gameId]/GameClient.tsx` | Mount `<GameActions>` + `<TerminalBanner>`; extend state to track `terminationReason`; thread it through realtime + applyStatusLocal. |
| `app/games/[gameId]/page.tsx` | Extend SELECT + RowSchema with `termination_reason`; pass `initialTerminationReason` prop. |
| `components/ui/alert-dialog.tsx` | shadcn-installed AlertDialog. |
| `e2e/resign.spec.ts` | Two-context resign flow + realtime status echo. |
| `e2e/abort.spec.ts` | Abort happy-path + ply ≥ 1 rejection. |
| `e2e/multiplayer-untimed.spec.ts` | Extend with banner assertion after fool's mate. |

---

## Tasks

### Task 1: Branch off dev

**Subagent:** Haiku · low effort

**Files:** none (git only).

- [ ] **Step 1: Pull latest dev and branch**

```bash
cd C:/workspace/narrative-chess-v2
git checkout dev
git pull
git checkout -b feat/phase-6-game-end-states
```

Expected: switched to new branch.

---

### Task 2: Migration — termination_reason + resign + abort_game RPCs

**Subagent:** Sonnet · standard effort

**Files:**
- Create: `supabase/migrations/<ts>_resign_and_abort_rpcs.sql`

- [ ] **Step 1: Generate the migration file**

```bash
supabase migration new resign_and_abort_rpcs
```

- [ ] **Step 2: Write the migration body**

```sql
-- Phase 6 — termination_reason column + resign + abort_game RPCs
-- Spec: docs/superpowers/specs/2026-05-03-v2-phase-6-game-end-states-design.md §4

set check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- 1. games.termination_reason — captures HOW the game ended so the banner
--    can distinguish "white wins by checkmate" from "white wins by resignation".
--    Nullable; populated by the relevant RPC on terminal transitions.
-- ----------------------------------------------------------------------------

alter table public.games
  add column termination_reason text
    check (termination_reason in (
      'checkmate',
      'stalemate',
      'threefold',
      'fifty_move',
      'insufficient',
      'resignation',
      'abort'
    ));

comment on column public.games.termination_reason is
  'How the game ended: checkmate / stalemate / threefold / fifty_move / insufficient / resignation / abort. Null while game is open or in progress.';

-- ----------------------------------------------------------------------------
-- 2. make_move RPC — extend to populate termination_reason when a chess
--    engine terminal status is passed in. The Server Action passes
--    p_terminal_status; we map it to a termination_reason here so the RPC
--    is the single writer of the column for engine-driven endings.
--
--    The Server Action does NOT compute termination_reason — chess.js
--    already drives terminal_status in the engine wrapper. We translate
--    the status enum into a reason here, plus null on non-terminal moves.
-- ----------------------------------------------------------------------------

create or replace function public.make_move(
  p_game_id uuid,
  p_uci text,
  p_san text,
  p_fen_after text,
  p_expected_ply int,
  p_terminal_status text default null
)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
  v_caller uuid := auth.uid();
  v_new_status text;
  v_termination_reason text;
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  select * into g from public.games where id = p_game_id for update;

  if not found then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;

  if v_caller <> g.white_id and v_caller <> g.black_id then
    raise exception 'not_a_participant' using errcode = 'P0001';
  end if;

  if g.ply <> p_expected_ply then
    raise exception 'concurrency_conflict' using errcode = 'P0001',
      detail = format('expected_ply=%s, current_ply=%s', p_expected_ply, g.ply);
  end if;

  if g.status <> 'in_progress' then
    raise exception 'not_active' using errcode = 'P0001',
      detail = format('current_status=%s', g.status);
  end if;

  if g.current_turn = 'w' and v_caller <> g.white_id then
    raise exception 'wrong_turn' using errcode = 'P0001';
  end if;
  if g.current_turn = 'b' and v_caller <> g.black_id then
    raise exception 'wrong_turn' using errcode = 'P0001';
  end if;

  v_new_status := coalesce(p_terminal_status, 'in_progress');
  if v_new_status not in ('in_progress','white_won','black_won','draw') then
    raise exception 'invalid_terminal_status' using errcode = 'P0001';
  end if;

  -- Map terminal status -> termination_reason. Chess.js drives this; the
  -- Server Action passes the status (which embeds the result) and we
  -- collapse it back to a reason. Resignation / abort have their own RPCs
  -- and never reach this branch.
  v_termination_reason := case
    when v_new_status = 'white_won' or v_new_status = 'black_won' then 'checkmate'
    when v_new_status = 'draw' then 'stalemate'  -- engine wrapper aggregates several into 'draw'; UI may want finer; for now, default to stalemate
    else null
  end;

  -- Append the move.
  insert into public.game_moves (game_id, ply, san, uci, fen_after, played_by)
  values (p_game_id, g.ply + 1, p_san, p_uci, p_fen_after, v_caller);

  update public.games
  set
    ply = g.ply + 1,
    current_fen = p_fen_after,
    current_turn = case when g.current_turn = 'w' then 'b' else 'w' end,
    status = v_new_status,
    termination_reason = v_termination_reason,
    ended_at = case when v_new_status in ('white_won','black_won','draw') then now() else null end
  where id = p_game_id
  returning * into g;

  return g;
end;
$$;

comment on function public.make_move(uuid, text, text, text, int, text) is
  'Atomic move append. Server Action validates with chess.js; RPC checks participant + concurrency + status, inserts move, updates game, sets termination_reason on terminal transitions.';

-- ----------------------------------------------------------------------------
-- 3. resign(p_game_id) — caller forfeits; opposite color wins.
-- ----------------------------------------------------------------------------

create or replace function public.resign(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
  v_caller uuid := auth.uid();
  v_new_status text;
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  select * into g from public.games where id = p_game_id for update;

  if not found then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;

  if v_caller <> g.white_id and v_caller <> g.black_id then
    raise exception 'not_a_participant' using errcode = 'P0001';
  end if;

  if g.status <> 'in_progress' then
    raise exception 'not_active' using errcode = 'P0001',
      detail = format('current_status=%s', g.status);
  end if;

  -- Caller forfeits; opponent wins.
  if v_caller = g.white_id then
    v_new_status := 'black_won';
  else
    v_new_status := 'white_won';
  end if;

  update public.games
  set
    status = v_new_status,
    termination_reason = 'resignation',
    ended_at = now()
  where id = p_game_id
  returning * into g;

  return g;
end;
$$;

revoke all on function public.resign(uuid) from public, anon;
grant execute on function public.resign(uuid) to authenticated;

comment on function public.resign(uuid) is
  'Caller forfeits the game; opposite color wins. Status flips and termination_reason=resignation.';

-- ----------------------------------------------------------------------------
-- 4. abort_game(p_game_id) — pre-move-1 escape; status -> aborted.
-- ----------------------------------------------------------------------------

create or replace function public.abort_game(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  select * into g from public.games where id = p_game_id for update;

  if not found then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;

  if v_caller <> g.white_id and v_caller <> g.black_id then
    raise exception 'not_a_participant' using errcode = 'P0001';
  end if;

  if g.ply > 0 or g.status not in ('open', 'in_progress') then
    raise exception 'not_abortable' using errcode = 'P0001',
      detail = format('ply=%s, status=%s', g.ply, g.status);
  end if;

  update public.games
  set
    status = 'aborted',
    termination_reason = 'abort',
    ended_at = now()
  where id = p_game_id
  returning * into g;

  return g;
end;
$$;

revoke all on function public.abort_game(uuid) from public, anon;
grant execute on function public.abort_game(uuid) to authenticated;

comment on function public.abort_game(uuid) is
  'Pre-move-1 abort. Either participant can call; ply must be 0. Status flips to aborted, termination_reason=abort.';
```

- [ ] **Step 3: Apply the migration**

```bash
supabase db push
```

Expected: migration applies cleanly.

- [ ] **Step 4: Smoke-check**

Open Supabase Studio (or use the MCP `execute_sql` tool) and run:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'games' and column_name = 'termination_reason';
-- expected: 1 row, text
```

```sql
select public.resign('00000000-0000-0000-0000-000000000000');
-- expected: error 'unauthenticated' (no JWT)
```

- [ ] **Step 5: Run the Supabase advisor lint**

```bash
supabase db lint
```

Expected: no new advisors regressed.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/*_resign_and_abort_rpcs.sql
git commit -m "feat(phase 6): termination_reason col + resign + abort_game RPCs"
```

---

### Task 3: Game schemas — Resign + Abort + extended status update

**Subagent:** Sonnet · low effort

**Files:**
- Modify: `lib/schemas/game.ts`
- Modify: `lib/schemas/game.test.ts`

- [ ] **Step 1: Append to `lib/schemas/game.ts`**

```ts
// (Add to existing file, alongside other exports.)

export const TerminationReasonSchema = z.enum([
  "checkmate",
  "stalemate",
  "threefold",
  "fifty_move",
  "insufficient",
  "resignation",
  "abort",
]);
export type TerminationReason = z.infer<typeof TerminationReasonSchema>;

export const ResignInputSchema = z.object({
  gameId: z.string().uuid(),
});
export type ResignInput = z.infer<typeof ResignInputSchema>;

export const AbortInputSchema = z.object({
  gameId: z.string().uuid(),
});
export type AbortInput = z.infer<typeof AbortInputSchema>;
```

(Note: the existing `lib/schemas/game.ts` uses `z.guid()` for placeholder UUIDs in tests; for these *server-input* schemas we use `.uuid()` strict because real client requests carry RFC-4122 v4 IDs.)

- [ ] **Step 2: Extend `GameStatusUpdateEventSchema`**

In `lib/schemas/game.ts`, change the existing schema to include the new column:

```ts
export const GameStatusUpdateEventSchema = z.object({
  id: z.string().uuid(),
  status: GameStatusSchema,
  white_id: z.string().uuid().nullable(),
  black_id: z.string().uuid().nullable(),
  termination_reason: TerminationReasonSchema.nullable().optional(),
});
```

Add `.optional()` so realtime payloads from rows that pre-date the column don't fail to parse.

- [ ] **Step 3: Add tests in `lib/schemas/game.test.ts`**

```ts
// Append to the existing describe blocks.

describe("TerminationReasonSchema", () => {
  test("accepts the seven valid reasons", () => {
    for (const r of [
      "checkmate", "stalemate", "threefold",
      "fifty_move", "insufficient", "resignation", "abort",
    ] as const) {
      expect(TerminationReasonSchema.safeParse(r).success).toBe(true);
    }
  });
  test("rejects unknown reasons", () => {
    expect(TerminationReasonSchema.safeParse("forfeit").success).toBe(false);
  });
});

describe("ResignInputSchema", () => {
  test("accepts a uuid", () => {
    expect(ResignInputSchema.safeParse({ gameId: UUID }).success).toBe(true);
  });
  test("rejects non-uuid", () => {
    expect(ResignInputSchema.safeParse({ gameId: "abc" }).success).toBe(false);
  });
});

describe("AbortInputSchema", () => {
  test("accepts a uuid", () => {
    expect(AbortInputSchema.safeParse({ gameId: UUID }).success).toBe(true);
  });
});

describe("GameStatusUpdateEventSchema (extended)", () => {
  test("accepts shape with termination_reason", () => {
    const r = GameStatusUpdateEventSchema.safeParse({
      id: UUID,
      status: "white_won",
      white_id: UUID,
      black_id: UUID,
      termination_reason: "resignation",
    });
    expect(r.success).toBe(true);
  });
  test("accepts shape without termination_reason", () => {
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

Update the import block at top of the test file to include `TerminationReasonSchema, ResignInputSchema, AbortInputSchema`.

Note: the existing test fixture uses `UUID = "00000000-0000-0000-0000-000000000001"`, which `.uuid()` strict rejects. The *new* schemas (`ResignInput`, `AbortInput`) use `.uuid()` strict, so the test cases above use a real RFC-4122 v4 placeholder: `"00000000-0000-4000-8000-000000000001"`. Update the test fixtures to use this v4-shaped UUID where the new schemas are exercised.

- [ ] **Step 4: Run tests**

```bash
bun test lib/schemas/game.test.ts
```

Expected: all schema tests pass (existing + new).

- [ ] **Step 5: Typecheck + lint**

```bash
bunx tsc --noEmit
bun run lint
```

- [ ] **Step 6: Commit**

```bash
git add lib/schemas/game.ts lib/schemas/game.test.ts
git commit -m "feat(phase 6): zod schemas for resign + abort + termination_reason"
```

---

### Task 4: Server Actions — resign + abortGame

**Subagent:** Sonnet · standard effort

**Files:**
- Modify: `app/games/[gameId]/actions.ts`

- [ ] **Step 1: Append the new actions**

Add to `app/games/[gameId]/actions.ts` (alongside existing `makeMove` and `joinGame`):

```ts
import { ResignInputSchema, AbortInputSchema } from "@/lib/schemas/game";

export type ResignErrorCode =
  | "validation"
  | "unauthenticated"
  | "game_not_found"
  | "not_active"
  | "not_a_participant"
  | "unknown";

export type ResignOutcome =
  | { ok: true }
  | { ok: false; code: ResignErrorCode; message: string };

function mapResignPgError(msg: string): ResignErrorCode {
  if (msg.includes("not_a_participant")) return "not_a_participant";
  if (msg.includes("not_active")) return "not_active";
  if (msg.includes("game_not_found")) return "game_not_found";
  if (msg.includes("unauthenticated")) return "unauthenticated";
  return "unknown";
}

export async function resign(input: unknown): Promise<ResignOutcome> {
  const parsed = ResignInputSchema.safeParse(input);
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

  const { error } = await supabase.rpc("resign", { p_game_id: parsed.data.gameId });
  if (error) {
    return { ok: false, code: mapResignPgError(error.message), message: error.message };
  }

  return { ok: true };
}

export type AbortErrorCode =
  | "validation"
  | "unauthenticated"
  | "game_not_found"
  | "not_a_participant"
  | "not_abortable"
  | "unknown";

export type AbortOutcome =
  | { ok: true }
  | { ok: false; code: AbortErrorCode; message: string };

function mapAbortPgError(msg: string): AbortErrorCode {
  if (msg.includes("not_abortable")) return "not_abortable";
  if (msg.includes("not_a_participant")) return "not_a_participant";
  if (msg.includes("game_not_found")) return "game_not_found";
  if (msg.includes("unauthenticated")) return "unauthenticated";
  return "unknown";
}

export async function abortGame(input: unknown): Promise<AbortOutcome> {
  const parsed = AbortInputSchema.safeParse(input);
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

  const { error } = await supabase.rpc("abort_game", { p_game_id: parsed.data.gameId });
  if (error) {
    return { ok: false, code: mapAbortPgError(error.message), message: error.message };
  }

  return { ok: true };
}
```

The existing `import { createClient } from "@/lib/supabase/server"` at the top is reused; only add `ResignInputSchema, AbortInputSchema` to imports.

- [ ] **Step 2: Typecheck + lint**

```bash
bunx tsc --noEmit
bun run lint
```

- [ ] **Step 3: Commit**

```bash
git add app/games/[gameId]/actions.ts
git commit -m "feat(phase 6): server actions resign + abortGame"
```

---

### Task 5: Install shadcn alert-dialog

**Subagent:** Haiku · low effort

**Files:**
- Create: `components/ui/alert-dialog.tsx`

- [ ] **Step 1: Install**

```bash
bunx shadcn@latest add alert-dialog
```

If shadcn prompts, accept defaults non-interactively where possible.

- [ ] **Step 2: Verify**

```bash
bunx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/alert-dialog.tsx package.json bun.lock
git commit -m "chore(deps): add shadcn alert-dialog for resign/abort confirms"
```

---

### Task 6: GameActions component

**Subagent:** Sonnet · standard effort

**Files:**
- Create: `app/games/[gameId]/GameActions.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { resign, abortGame } from "./actions";
import type { GameStatus } from "@/lib/schemas/game";

type Props = {
  gameId: string;
  status: GameStatus;
  ply: number;
  isObserver: boolean;
};

type Pending = "resign" | "abort" | null;

export function GameActions({ gameId, status, ply, isObserver }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<Pending>(null);

  if (isObserver) return null;
  if (status !== "in_progress") return null;

  const showAbort = ply === 0;
  const showResign = ply >= 1;

  const onResign = () => {
    startTransition(async () => {
      const result = await resign({ gameId });
      setConfirming(null);
      if (result.ok) return;
      switch (result.code) {
        case "not_active":
          toast.warning("Game is no longer active");
          router.refresh();
          break;
        case "not_a_participant":
          toast.error("You're not a player in this game");
          break;
        case "game_not_found":
          toast.error("Game not found");
          break;
        case "unauthenticated":
          toast.error("Sign in again");
          router.push(`/login?next=/games/${gameId}`);
          break;
        case "validation":
          toast.error("Invalid request");
          break;
        default:
          toast.error("Something went wrong — try again");
      }
    });
  };

  const onAbort = () => {
    startTransition(async () => {
      const result = await abortGame({ gameId });
      setConfirming(null);
      if (result.ok) return;
      switch (result.code) {
        case "not_abortable":
          toast.warning("Game has already started");
          router.refresh();
          break;
        case "not_a_participant":
          toast.error("You're not a player in this game");
          break;
        case "game_not_found":
          toast.error("Game not found");
          break;
        case "unauthenticated":
          toast.error("Sign in again");
          router.push(`/login?next=/games/${gameId}`);
          break;
        case "validation":
          toast.error("Invalid request");
          break;
        default:
          toast.error("Something went wrong — try again");
      }
    });
  };

  return (
    <>
      <div className="flex items-center justify-center gap-2 text-sm">
        {showAbort && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setConfirming("abort")}
          >
            Abort
          </Button>
        )}
        {showResign && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setConfirming("resign")}
          >
            Resign
          </Button>
        )}
      </div>

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming === "resign" ? "Resign game?" : "Abort game?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming === "resign"
                ? "Your opponent will win. This cannot be undone."
                : "The game ends with no result. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={confirming === "resign" ? onResign : onAbort}
            >
              {pending ? "…" : confirming === "resign" ? "Resign" : "Abort"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
bunx tsc --noEmit
bun run lint
```

- [ ] **Step 3: Commit**

```bash
git add app/games/[gameId]/GameActions.tsx
git commit -m "feat(phase 6): GameActions — resign + abort buttons with confirm dialog"
```

---

### Task 7: TerminalBanner component

**Subagent:** Sonnet · low effort

**Files:**
- Create: `app/games/[gameId]/TerminalBanner.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GameStatus, TerminationReason } from "@/lib/schemas/game";

type Props = {
  status: GameStatus;
  terminationReason: TerminationReason | null;
  isObserver: boolean;
};

const TERMINAL: GameStatus[] = ["white_won", "black_won", "draw", "aborted"];

function describe(status: GameStatus, reason: TerminationReason | null): {
  title: string;
  subtitle: string;
} {
  if (status === "aborted") {
    return {
      title: "Game aborted",
      subtitle: "Started before the first move was made.",
    };
  }
  if (status === "draw") {
    const subtitle =
      reason === "stalemate"
        ? "By stalemate."
        : reason === "threefold"
          ? "By threefold repetition."
          : reason === "fifty_move"
            ? "By the fifty-move rule."
            : reason === "insufficient"
              ? "By insufficient material."
              : "Drawn.";
    return { title: "Draw", subtitle };
  }
  const winner = status === "white_won" ? "White" : "Black";
  const subtitle =
    reason === "checkmate"
      ? "By checkmate."
      : reason === "resignation"
        ? "By resignation."
        : "Game over.";
  return { title: `${winner} wins`, subtitle };
}

export function TerminalBanner({ status, terminationReason, isObserver }: Props) {
  const router = useRouter();
  if (!TERMINAL.includes(status)) return null;
  const { title, subtitle } = describe(status, terminationReason);

  return (
    <div
      className={cn(
        "max-w-xl mx-auto w-full rounded border bg-card p-4",
        "flex items-center justify-between gap-4",
      )}
      role="status"
    >
      <div className="min-w-0">
        <h2 className="text-lg font-heading font-semibold truncate">{title}</h2>
        <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
      </div>
      {!isObserver && (
        <Button type="button" onClick={() => router.push("/games/new")}>
          Start new game
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
bunx tsc --noEmit
bun run lint
```

- [ ] **Step 3: Commit**

```bash
git add app/games/[gameId]/TerminalBanner.tsx
git commit -m "feat(phase 6): TerminalBanner — winner / reason / start-new-game CTA"
```

---

### Task 8: GameClient integration

**Subagent:** Opus · high effort _(extends the most-load-bearing component in the project)_

**Files:**
- Modify: `app/games/[gameId]/GameClient.tsx`

This task changes the GameClient component to:
1. Accept a new prop `initialTerminationReason: TerminationReason | null`.
2. Track `terminationReason` in `State`.
3. Update `applyStatusLocal` to also accept + apply termination_reason from realtime payloads (the schema has been extended in Task 3).
4. Mount `<GameActions>` in the sidebar (between the player pills, beneath the turn pill, OR as a separate row — choose what looks cleanest given the existing layout).
5. Mount `<TerminalBanner>` above the board container, conditionally on terminal status.
6. Drop any pending optimistic move + drag selection if status flips to terminal during a pending submit (defensive — make_move RPC rejects with `not_active` if the game ends mid-pending, but the client should also clear ref-tracked rollback targets).

- [ ] **Step 1: Update Props + State**

In `app/games/[gameId]/GameClient.tsx`:

```tsx
import type { GameStatus, TerminationReason } from "@/lib/schemas/game";
import { GameActions } from "./GameActions";
import { TerminalBanner } from "./TerminalBanner";

type Props = {
  gameId: string;
  myColor: "w" | "b" | null;
  whiteName: string;
  blackName: string;
  initialFen: string;
  initialPly: number;
  initialStatus: GameStatus;
  initialTerminationReason: TerminationReason | null;  // NEW
};

type State = {
  fen: string;
  ply: number;
  status: GameStatus;
  terminationReason: TerminationReason | null;  // NEW
  pending: boolean;
};

// In useState seed:
const [state, setState] = useState<State>({
  fen: initialFen,
  ply: initialPly,
  status: initialStatus,
  terminationReason: initialTerminationReason,
  pending: false,
});
```

- [ ] **Step 2: Extend `applyStatusLocal`**

```tsx
const applyStatusLocal = useCallback(
  (status: GameStatus, terminationReason?: TerminationReason | null) => {
    setState((prev) => ({
      ...prev,
      status,
      terminationReason: terminationReason !== undefined ? terminationReason : prev.terminationReason,
    }));
  },
  [],
);
```

Update the `subscribeToGameStatus` callback to pass through:

```tsx
void subscribeToGameStatus(gameId, (u) =>
  applyStatusLocal(u.status, u.termination_reason ?? null),
).then(...);
```

- [ ] **Step 3: Pass termination_reason from `applyMoveLocal` server-confirm path**

The `submitMove` success branch passes `result.data.status` to `applyMoveLocal`. The make_move RPC return now includes `termination_reason` (we extended the table; supabase-js returns the full row). Update `MakeMoveResultSchema` in `lib/schemas/move.ts` to include `termination_reason: TerminationReasonSchema.nullable().optional()`, then thread it through:

```tsx
applyMoveLocal({
  ply: result.data.ply,
  fen: result.data.fen_after,
  status: result.data.status,
  terminationReason: result.data.termination_reason ?? null,  // NEW
});
```

Extend `applyMoveLocal` signature to accept the optional reason and apply it under the same ply-monotonic guard.

(Note: this requires editing `lib/schemas/move.ts` too. Add `TerminationReasonSchema` import. The schema in move.ts may need a sibling test update.)

- [ ] **Step 4: Mount `<TerminalBanner>` + `<GameActions>`**

In the JSX return:

```tsx
return (
  <main className="container mx-auto max-w-6xl py-8 px-6 space-y-4">
    {/* Test hook ... existing ... */}

    <TerminalBanner
      status={state.status}
      terminationReason={state.terminationReason}
      isObserver={isObserver}
    />

    <div className="flex justify-center">
      <div className="w-full max-w-xl aspect-square">
        <Chessboard ... />
      </div>
    </div>

    <aside className="...existing...">
      {/* Three pills as before */}
    </aside>

    <GameActions
      gameId={gameId}
      status={state.status}
      ply={state.ply}
      isObserver={isObserver}
    />
  </main>
);
```

`GameActions` returns null for observer / non-in-progress; safe to mount unconditionally.

- [ ] **Step 5: Defensive — clear pending move ref on terminal transition**

Add an effect:

```tsx
useEffect(() => {
  if (TERMINAL.includes(state.status)) {
    pendingMoveRef.current = null;
    setSelected(null);
    setDragSource(null);
    setHoverSquare(null);
  }
}, [state.status]);
```

(`TERMINAL` is the existing const array.)

- [ ] **Step 6: Typecheck + lint**

```bash
bunx tsc --noEmit
bun run lint
```

- [ ] **Step 7: Commit**

```bash
git add app/games/[gameId]/GameClient.tsx lib/schemas/move.ts
git commit -m "feat(phase 6): GameClient mounts banner + actions; tracks termination_reason"
```

---

### Task 9: Game route — extend SELECT for termination_reason

**Subagent:** Sonnet · low effort

**Files:**
- Modify: `app/games/[gameId]/page.tsx`

- [ ] **Step 1: Extend select + RowSchema + props**

Update the SELECT to include `termination_reason`:

```ts
.select(`
  id,
  white_id,
  black_id,
  current_fen,
  ply,
  status,
  current_turn,
  termination_reason,
  white_name:white_id ( display_name ),
  black_name:black_id ( display_name )
`)
```

Update `RowSchema` to include:

```ts
termination_reason: TerminationReasonSchema.nullable(),
```

Pass through to `<GameClient>`:

```tsx
<GameClient
  gameId={gameId}
  myColor={...}
  whiteName={...}
  blackName={...}
  initialFen={row.current_fen}
  initialPly={row.ply}
  initialStatus={row.status}
  initialTerminationReason={row.termination_reason}  // NEW
/>
```

Add `import { TerminationReasonSchema } from "@/lib/schemas/game"` at the top.

- [ ] **Step 2: Typecheck + lint**

```bash
bunx tsc --noEmit
bun run lint
```

- [ ] **Step 3: Commit**

```bash
git add app/games/[gameId]/page.tsx
git commit -m "feat(phase 6): hydrate termination_reason from games row"
```

---

### Task 10: E2E — resign flow

**Subagent:** Sonnet · standard effort

**Files:**
- Create: `e2e/resign.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ensureUser } from "./lib/auth-helper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY,
  "skipped: env vars not set",
);

const ALICE = {
  email: "phase6-alice-resign@narrativechess.test",
  password: "phase6-pw-alice-resign",
};
const BOB = {
  email: "phase6-bob-resign@narrativechess.test",
  password: "phase6-pw-bob-resign",
};

test("resign flips status to opponent-color win + termination_reason=resignation", async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const aliceUser = await ensureUser(ALICE.email, ALICE.password);
  const bobUser = await ensureUser(BOB.email, BOB.password);

  // Set up an in-progress game with at least one move so resign (not abort) applies.
  const { data: created, error: ce } = await admin
    .from("games")
    .insert({
      white_id: aliceUser.id,
      black_id: bobUser.id,
      status: "in_progress",
      current_fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      current_turn: "b",
      ply: 1,
    })
    .select("id")
    .single();
  if (ce) throw ce;
  const gameId = created!.id;

  // Alice (white) resigns.
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: sess, error: signInErr } = await anon.auth.signInWithPassword({
    email: ALICE.email,
    password: ALICE.password,
  });
  if (signInErr || !sess.session) throw signInErr ?? new Error("sign-in failed");
  const aliceClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${sess.session.access_token}` },
    },
  });

  const { error: resignErr } = await aliceClient.rpc("resign", { p_game_id: gameId });
  expect(resignErr).toBeNull();

  // Verify final state.
  const { data: g } = await admin
    .from("games")
    .select("status, termination_reason, ended_at")
    .eq("id", gameId)
    .single();
  expect(g!.status).toBe("black_won");
  expect(g!.termination_reason).toBe("resignation");
  expect(g!.ended_at).not.toBeNull();

  // Cleanup.
  await admin.from("games").delete().eq("id", gameId);
});
```

- [ ] **Step 2: Run**

```bash
bunx playwright test e2e/resign.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/resign.spec.ts
git commit -m "test(phase 6): e2e resign — status flips + termination_reason=resignation"
```

---

### Task 11: E2E — abort flow

**Subagent:** Sonnet · standard effort

**Files:**
- Create: `e2e/abort.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ensureUser } from "./lib/auth-helper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY,
  "skipped: env vars not set",
);

const ALICE = {
  email: "phase6-alice-abort@narrativechess.test",
  password: "phase6-pw-alice-abort",
};
const BOB = {
  email: "phase6-bob-abort@narrativechess.test",
  password: "phase6-pw-bob-abort",
};

async function userClient(email: string, password: string) {
  const c = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

test("abort at ply=0 — status flips to aborted + termination_reason=abort", async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const aliceUser = await ensureUser(ALICE.email, ALICE.password);
  const bobUser = await ensureUser(BOB.email, BOB.password);

  const { data: created } = await admin
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
  const gameId = created!.id;

  const aliceClient = await userClient(ALICE.email, ALICE.password);
  const { error: abortErr } = await aliceClient.rpc("abort_game", { p_game_id: gameId });
  expect(abortErr).toBeNull();

  const { data: g } = await admin
    .from("games")
    .select("status, termination_reason, ended_at")
    .eq("id", gameId)
    .single();
  expect(g!.status).toBe("aborted");
  expect(g!.termination_reason).toBe("abort");
  expect(g!.ended_at).not.toBeNull();

  await admin.from("games").delete().eq("id", gameId);
});

test("abort at ply=1 — RPC rejects with not_abortable", async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const aliceUser = await ensureUser(ALICE.email, ALICE.password);
  const bobUser = await ensureUser(BOB.email, BOB.password);

  const { data: created } = await admin
    .from("games")
    .insert({
      white_id: aliceUser.id,
      black_id: bobUser.id,
      status: "in_progress",
      current_fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      current_turn: "b",
      ply: 1,
    })
    .select("id")
    .single();
  const gameId = created!.id;

  const aliceClient = await userClient(ALICE.email, ALICE.password);
  const { error } = await aliceClient.rpc("abort_game", { p_game_id: gameId });
  expect(error).not.toBeNull();
  expect(error!.message).toMatch(/not_abortable/);

  await admin.from("games").delete().eq("id", gameId);
});
```

- [ ] **Step 2: Run**

```bash
bunx playwright test e2e/abort.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/abort.spec.ts
git commit -m "test(phase 6): e2e abort — happy path + ply >= 1 rejection"
```

---

### Task 12: Extend multiplayer-untimed.spec.ts — banner assertion

**Subagent:** Haiku · low effort

**Files:**
- Modify: `e2e/multiplayer-untimed.spec.ts`

- [ ] **Step 1: Add banner check**

After the existing fool's-mate sequence that asserts `data-status="black_won"`, add:

```ts
// Banner is rendered for terminal status.
await expect(alice.getByRole("status").getByText(/black wins/i)).toBeVisible();
await expect(alice.getByRole("status").getByText(/by checkmate/i)).toBeVisible();
```

(The TerminalBanner component renders `role="status"`; using getByRole keeps the assertion robust to surrounding markup.)

- [ ] **Step 2: Run**

```bash
bunx playwright test e2e/multiplayer-untimed.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/multiplayer-untimed.spec.ts
git commit -m "test(phase 6): assert TerminalBanner renders after fool's mate"
```

---

### Task 13: Verification gate

**Subagent:** Haiku · low effort

**Files:** none (verification only).

- [ ] **Step 1: Lint**

```bash
bun run lint
```

- [ ] **Step 2: Typecheck**

```bash
bunx tsc --noEmit
```

- [ ] **Step 3: Unit tests**

```bash
bun test
```

- [ ] **Step 4: E2E**

```bash
bunx playwright test
```

- [ ] **Step 5: Supabase advisor lint**

```bash
supabase db lint
```

- [ ] **Step 6: Two-browser manual smoke**

`bun run dev`, then in two browsers:

1. Alice creates a game, white. Bob joins. Confirm both see GameActions buttons.
2. Bob aborts before any move → both browsers show the TerminalBanner with "Game aborted" + Bob can click "Start new game".
3. New game, Alice white, Bob black. Alice plays e2e4. Resign button now visible. Alice clicks Resign → confirm. Banner shows "Black wins / By resignation".
4. New game, fool's mate to checkmate. Banner shows "Black wins / By checkmate".

If any step fails, debug and re-run the gate.

---

### Task 14: Open PR `feat/phase-6-game-end-states` → `dev`

**Subagent:** Haiku · low effort

**Files:** none (git/GitHub).

- [ ] **Step 1: Push**

```bash
git push -u origin feat/phase-6-game-end-states
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --base dev --head feat/phase-6-game-end-states \
  --title "feat: Phase 6 — game end states + resign / abort" \
  --body "$(cat <<'EOF'
## Summary

- New `games.termination_reason` column distinguishing "white wins by checkmate" from "white wins by resignation" (and the four draw types).
- Two new SECURITY DEFINER RPCs: `resign(p_game_id)` (caller forfeits, opposite color wins) and `abort_game(p_game_id)` (pre-move-1 escape, status -> aborted). Both row-locked, both participant-checked.
- `make_move` RPC extended to populate `termination_reason` on chess-engine terminal transitions (checkmate / draw).
- `<GameActions>` client component — resign + abort buttons in the sidebar, gated by ply (abort only at ply=0, resign only at ply >= 1) and observer status. Confirms via shadcn AlertDialog.
- `<TerminalBanner>` client component — winner / reason callout above the board with a "Start new game" CTA.
- `<GameClient>` extended to track `terminationReason` in state and thread it through realtime + applyMoveLocal.

## Test plan

- [ ] `bun run lint`
- [ ] `bunx tsc --noEmit`
- [ ] `bun test`
- [ ] `bunx playwright test`
- [ ] `supabase db lint`
- [ ] Two-browser manual smoke: abort at ply=0, resign mid-game, fool's mate -> banner all show.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for CI green**

```bash
gh pr checks <pr#> --watch
```

- [ ] **Step 4: Squash-merge**

After CI green + manual smoke passes:

```bash
gh pr merge <pr#> --squash --delete-branch
```

Phase 6 done. Next: M1 ship (`dev` → `main` PR), per the foundation spec Step M.

---

## Self-review notes

- All spec sections (§4.1–§4.8, §5, §6) map to a task above. §7 verification gate maps to Task 13.
- Every step shows actual code or actual commands; no "TBD" / "implement validation" / "similar to Task N".
- Type names (`GameStatus`, `TerminationReason`, `ResignOutcome`, `AbortOutcome`, `MakeMoveResult`) used in later tasks match earlier definitions.
- One known schema-version detail: `lib/schemas/game.ts` uses `z.guid()` (looser GUID) for placeholder UUIDs in tests, but the new `ResignInputSchema` / `AbortInputSchema` use `.uuid()` strict because real client requests use RFC-4122 v4. Test fixtures for the new schemas use a v4-shaped UUID to match.
