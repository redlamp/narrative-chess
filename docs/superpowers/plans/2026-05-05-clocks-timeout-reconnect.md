# M1.5++ Clocks, Timeout, Reconnect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-authoritative clocks (live + correspondence), per-side timeout detection (lazy + auto-claim + daily cron sweep), and strict-reconnect policy to multiplayer chess.

**Architecture:** Extend `games` table with time-control columns + per-side remaining ms + `turn_started_at` anchor. Server enforces deadlines via `make_move` lazy check, `claim_timeout` RPC, and daily Vercel Cron `end_timeout` sweep. Client interpolates display locally (no server polling) and re-snaps on Realtime row updates.

**Tech Stack:** Supabase Postgres + Realtime, Next.js 16.2 + React 19 Server Actions, Tailwind v4 + shadcn, chess.js, Zod, Vitest, Playwright, Vercel Cron.

**Spec:** `docs/superpowers/specs/2026-05-05-clocks-timeout-reconnect-design.md`

---

## PR breakdown

| PR | Phase | Branch | Scope |
|---|---|---|---|
| 1 | A + B | `feat/clocks-schema-rpcs` | Schema migration + RPCs + Zod types + clock math units |
| 2 | C | `feat/clocks-ui` | TimeControlPicker, Clock component, GameClient integration, server action wiring, directory badge |
| 3 | D | `feat/clocks-cron-sweep` | Cron route, vercel.json, env docs |
| 4 | E | `feat/clocks-e2e` | Playwright e2e specs |

Each phase below ends with the PR open + merge commands.

---

## File Structure

### New files

**Migrations** (Supabase, in `supabase/migrations/`):

- `<ts>_add_clocks_to_games.sql` — schema delta, termination_reason check extension
- `<ts>_extend_create_game_for_clocks.sql` — `create_game` RPC accepts time-control args
- `<ts>_extend_join_open_game_for_clocks.sql` — `join_open_game` sets `turn_started_at`
- `<ts>_extend_make_move_for_clocks.sql` — `make_move` lazy timeout + clock math
- `<ts>_claim_and_end_timeout_rpcs.sql` — new `claim_timeout` (player-callable) + `end_timeout` (service-role)

**Lib** (pure code, `lib/`):

- `lib/chess/time-controls.ts` — preset definitions (Untimed / 5+0 / 10+0 / 15+10 / 1d/move)
- `lib/chess/time-controls.test.ts` — unit tests
- `lib/chess/clock.ts` — `computeRemaining`, `formatLive`, `formatCorrespondence`, `tickRateMs`
- `lib/chess/clock.test.ts` — unit tests
- `lib/schemas/clock.ts` — Zod schemas (`TimeControlSchema`, `ClockStateSchema`)

**App** (`app/`):

- `app/games/new/TimeControlPicker.tsx` — radio group of 5 presets
- `app/games/[gameId]/Clock.tsx` — countdown display, one per side
- `app/games/[gameId]/useAutoClaim.ts` — hook that fires `claimTimeout` when opponent clock hits 0
- `app/api/cron/timeout-sweep/route.ts` — daily cron endpoint

**Tests** (Playwright, `tests/e2e/`):

- `tests/e2e/clocks-live.spec.ts`
- `tests/e2e/clocks-correspondence.spec.ts`
- `tests/e2e/clocks-timeout.spec.ts`

### Modified files

- `app/games/new/NewGameForm.tsx` — embed `TimeControlPicker`
- `app/games/new/actions.ts` — extend `createGame` to pass time-control args to RPC
- `app/games/[gameId]/JoinGameForm.tsx` — show time control on join screen
- `app/games/[gameId]/actions.ts` — add `claimTimeout` server action
- `app/games/[gameId]/page.tsx` — fetch + pass new fields to `GameClient`
- `app/games/[gameId]/GameClient.tsx` — render two `Clock` instances, wire `useAutoClaim`
- `app/games/page.tsx` — small time-control badge per row
- `lib/schemas/game.ts` — extend `GameStatusSchema` (no change), `TerminationReasonSchema` (+`timeout`), add `TimeControlTypeSchema`, extend create-game input
- `lib/realtime/subscribe.ts` — surface new fields in payload (only if existing subscribe omits them)
- `vercel.json` — add `crons` entry
- `.env.example` — document `CRON_SECRET`

---

## Conventions

- **Migrations:** Created via `supabase migration new <name>`. Never edit a migration after `supabase db push`. Apply locally with `supabase db push` (when CLI is set up) or via dashboard SQL editor for hosted workflow per `tools/supabase-migration-history.md`.
- **Tests:** Vitest for unit (`lib/**/*.test.ts`), Playwright for e2e (`tests/e2e/*.spec.ts`).
- **Branching:** Each phase = one feat branch off `dev`, merge via PR with `gh pr merge --merge`.
- **Commits:** Conventional Commits. Stage files explicitly by name (no `git add -A`).
- **Co-author trailer:** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

## Phase A — Schema + types

Branch: `feat/clocks-schema-rpcs` (carries Phase B too).

### Task A1: Schema migration

**Files:**
- Create: `supabase/migrations/<ts>_add_clocks_to_games.sql`

- [ ] **Step A1.1: Generate migration file**

```bash
supabase migration new add_clocks_to_games
```

- [ ] **Step A1.2: Write migration content**

Contents of the new migration file:

```sql
-- M1.5++ — add clocks + timeout termination
-- Spec: docs/superpowers/specs/2026-05-05-clocks-timeout-reconnect-design.md §4

set check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- 1. games — add time-control + clock columns
-- ----------------------------------------------------------------------------

alter table public.games
  add column time_control_type text
    check (time_control_type in ('live', 'correspondence')),
  add column time_initial_seconds int,
  add column time_increment_seconds int default 0,
  add column time_per_move_seconds int,
  add column white_remaining_ms bigint,
  add column black_remaining_ms bigint,
  add column turn_started_at timestamptz;

comment on column public.games.time_control_type is
  'NULL=untimed (legacy or new); live=Fischer (initial+increment); correspondence=per-move deadline';
comment on column public.games.turn_started_at is
  'Wall-clock anchor for client interpolation + server elapsed math. NULL until in_progress.';

-- Constraint: live and correspondence have disjoint required column sets;
-- untimed is all NULL. New games may pick any.
alter table public.games
  add constraint games_time_control_shape check (
    (time_control_type = 'live'
       and time_initial_seconds is not null
       and time_per_move_seconds is null)
    or (time_control_type = 'correspondence'
       and time_per_move_seconds is not null
       and time_initial_seconds is null)
    or (time_control_type is null)
  );

-- ----------------------------------------------------------------------------
-- 2. termination_reason — add 'timeout' to allowed values
-- ----------------------------------------------------------------------------

-- The original add-column check constraint is auto-named by Postgres.
-- Resolve it via pg_constraint and drop, then re-add with timeout included.
do $$
declare c_name text;
begin
  select conname into c_name
  from pg_constraint
  where conrelid = 'public.games'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%termination_reason%';
  if c_name is not null then
    execute format('alter table public.games drop constraint %I', c_name);
  end if;
end $$;

alter table public.games
  add constraint games_termination_reason_check check (
    termination_reason in (
      'checkmate','stalemate','threefold','fifty_move','insufficient',
      'resignation','abort','timeout'
    )
  );
```

- [ ] **Step A1.3: Apply migration**

For hosted workflow (Supabase MCP — see `tools/supabase-migration-history.md`):

```
mcp__plugin_supabase_supabase__apply_migration(
  name="add_clocks_to_games",
  query=<the SQL above>
)
```

For local CLI (if set up):

```bash
supabase db push
```

- [ ] **Step A1.4: Verify schema**

```bash
# Or via mcp__plugin_supabase_supabase__execute_sql
supabase db lint
```

Inspect the games table and confirm new columns + constraints:

```sql
\d+ public.games
```

Expected: 7 new columns, 2 new check constraints (`games_time_control_shape`, `games_termination_reason_check`).

- [ ] **Step A1.5: Realtime + RLS gate**

Re-run gate procedure per `wiki/notes/realtime-rls-gate-procedure.md` — the publication is unchanged, but smoke-test that authenticated participants still get row updates with the new columns visible. Two-browser sanity check: open an existing untimed M1 game in two tabs, make a move, confirm Realtime payload contains the new columns (all NULL for the legacy game).

- [ ] **Step A1.6: Commit**

```bash
git checkout -b feat/clocks-schema-rpcs
git add supabase/migrations/<ts>_add_clocks_to_games.sql
git commit -m "$(cat <<'EOF'
feat(db): add clock columns + timeout termination to games

Schema delta only — RPC updates land in subsequent migrations.
Untimed games (legacy or new) tolerated via NULL time_control_type.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task A2: Schema types

**Files:**
- Modify: `lib/schemas/game.ts`
- Test: `lib/schemas/game.test.ts`

- [ ] **Step A2.1: Inspect current schema file**

```bash
# Read first to confirm shape
```

```ts
// Read lib/schemas/game.ts and lib/schemas/game.test.ts
```

- [ ] **Step A2.2: Write failing tests**

Append to `lib/schemas/game.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  TimeControlTypeSchema,
  TerminationReasonSchema,
  CreateGameInputSchema,
} from "./game";

describe("TimeControlTypeSchema", () => {
  it("accepts live, correspondence, null", () => {
    expect(TimeControlTypeSchema.parse("live")).toBe("live");
    expect(TimeControlTypeSchema.parse("correspondence")).toBe("correspondence");
    expect(TimeControlTypeSchema.parse(null)).toBe(null);
  });
  it("rejects unknown values", () => {
    expect(() => TimeControlTypeSchema.parse("classical")).toThrow();
    expect(() => TimeControlTypeSchema.parse("blitz")).toThrow();
  });
});

describe("TerminationReasonSchema with timeout", () => {
  it("accepts timeout", () => {
    expect(TerminationReasonSchema.parse("timeout")).toBe("timeout");
  });
});

describe("CreateGameInputSchema with time control", () => {
  it("accepts untimed (no time control fields)", () => {
    expect(
      CreateGameInputSchema.parse({ myColor: "white" }),
    ).toEqual({ myColor: "white" });
  });
  it("accepts live preset shape", () => {
    expect(
      CreateGameInputSchema.parse({
        myColor: "random",
        timeControlType: "live",
        timeInitialSeconds: 300,
        timeIncrementSeconds: 0,
      }),
    ).toMatchObject({ timeControlType: "live", timeInitialSeconds: 300 });
  });
  it("accepts correspondence preset shape", () => {
    expect(
      CreateGameInputSchema.parse({
        myColor: "black",
        timeControlType: "correspondence",
        timePerMoveSeconds: 86400,
      }),
    ).toMatchObject({ timeControlType: "correspondence", timePerMoveSeconds: 86400 });
  });
  it("rejects live shape with per-move set", () => {
    expect(() =>
      CreateGameInputSchema.parse({
        myColor: "white",
        timeControlType: "live",
        timeInitialSeconds: 300,
        timePerMoveSeconds: 60,
      }),
    ).toThrow();
  });
  it("rejects correspondence shape with initial set", () => {
    expect(() =>
      CreateGameInputSchema.parse({
        myColor: "white",
        timeControlType: "correspondence",
        timeInitialSeconds: 300,
        timePerMoveSeconds: 60,
      }),
    ).toThrow();
  });
});
```

- [ ] **Step A2.3: Run tests to confirm they fail**

```bash
bunx vitest run lib/schemas/game.test.ts
```

Expected: failing tests for `TimeControlTypeSchema is not exported`, etc.

- [ ] **Step A2.4: Update lib/schemas/game.ts**

Add (positions adapt to existing file):

```ts
import { z } from "zod";

// Add this export
export const TimeControlTypeSchema = z.enum(["live", "correspondence"]).nullable();
export type TimeControlType = z.infer<typeof TimeControlTypeSchema>;

// Update existing TerminationReasonSchema — add 'timeout'
export const TerminationReasonSchema = z.enum([
  "checkmate",
  "stalemate",
  "threefold",
  "fifty_move",
  "insufficient",
  "resignation",
  "abort",
  "timeout",
]);
export type TerminationReason = z.infer<typeof TerminationReasonSchema>;

// Extend CreateGameInputSchema
export const CreateGameInputSchema = z
  .object({
    myColor: z.enum(["white", "black", "random"]),
    timeControlType: TimeControlTypeSchema.optional(),
    timeInitialSeconds: z.number().int().positive().optional(),
    timeIncrementSeconds: z.number().int().nonnegative().optional(),
    timePerMoveSeconds: z.number().int().positive().optional(),
  })
  .refine(
    (v) => {
      if (!v.timeControlType) return true;
      if (v.timeControlType === "live") {
        return (
          v.timeInitialSeconds !== undefined && v.timePerMoveSeconds === undefined
        );
      }
      if (v.timeControlType === "correspondence") {
        return (
          v.timePerMoveSeconds !== undefined && v.timeInitialSeconds === undefined
        );
      }
      return true;
    },
    { message: "time control shape mismatch" },
  );
export type CreateGameInput = z.infer<typeof CreateGameInputSchema>;
```

- [ ] **Step A2.5: Run tests to confirm pass**

```bash
bunx vitest run lib/schemas/game.test.ts
```

Expected: all green.

- [ ] **Step A2.6: Typecheck**

```bash
bunx tsc --noEmit
```

Expected: no errors. (If `TerminationReason` is consumed elsewhere with the old narrow set, no fix needed — it's a widening.)

- [ ] **Step A2.7: Commit**

```bash
git add lib/schemas/game.ts lib/schemas/game.test.ts
git commit -m "$(cat <<'EOF'
feat(schemas): time control types + timeout termination

Adds TimeControlTypeSchema, extends TerminationReasonSchema with
'timeout', and grows CreateGameInputSchema to carry preset args.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task A3: Time control presets

**Files:**
- Create: `lib/chess/time-controls.ts`
- Test: `lib/chess/time-controls.test.ts`

- [ ] **Step A3.1: Write failing test**

`lib/chess/time-controls.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TIME_CONTROL_PRESETS, presetById, type PresetId } from "./time-controls";

describe("TIME_CONTROL_PRESETS", () => {
  it("has 5 presets in stable order", () => {
    const ids = TIME_CONTROL_PRESETS.map((p) => p.id);
    expect(ids).toEqual(["untimed", "5min", "10min", "15+10", "1day"]);
  });
  it("untimed has no time fields", () => {
    const p = presetById("untimed");
    expect(p.timeControlType).toBeNull();
    expect(p.timeInitialSeconds).toBeUndefined();
    expect(p.timePerMoveSeconds).toBeUndefined();
  });
  it("5min is live, initial 300, no increment", () => {
    const p = presetById("5min");
    expect(p).toMatchObject({
      timeControlType: "live",
      timeInitialSeconds: 300,
      timeIncrementSeconds: 0,
    });
  });
  it("15+10 is live, initial 900, increment 10", () => {
    const p = presetById("15+10");
    expect(p).toMatchObject({
      timeControlType: "live",
      timeInitialSeconds: 900,
      timeIncrementSeconds: 10,
    });
  });
  it("1day is correspondence, 86400 per move", () => {
    const p = presetById("1day");
    expect(p).toMatchObject({
      timeControlType: "correspondence",
      timePerMoveSeconds: 86400,
    });
  });
  it("presetById throws on unknown id", () => {
    expect(() => presetById("foo" as PresetId)).toThrow();
  });
});
```

- [ ] **Step A3.2: Run test, confirm fail**

```bash
bunx vitest run lib/chess/time-controls.test.ts
```

Expected: module not found.

- [ ] **Step A3.3: Implement `lib/chess/time-controls.ts`**

```ts
import type { TimeControlType } from "@/lib/schemas/game";

export type PresetId = "untimed" | "5min" | "10min" | "15+10" | "1day";

export type TimeControlPreset = {
  id: PresetId;
  label: string;
  timeControlType: TimeControlType;
  timeInitialSeconds?: number;
  timeIncrementSeconds?: number;
  timePerMoveSeconds?: number;
};

export const TIME_CONTROL_PRESETS: ReadonlyArray<TimeControlPreset> = [
  { id: "untimed", label: "Untimed", timeControlType: null },
  {
    id: "5min",
    label: "5 min",
    timeControlType: "live",
    timeInitialSeconds: 300,
    timeIncrementSeconds: 0,
  },
  {
    id: "10min",
    label: "10 min",
    timeControlType: "live",
    timeInitialSeconds: 600,
    timeIncrementSeconds: 0,
  },
  {
    id: "15+10",
    label: "15 + 10",
    timeControlType: "live",
    timeInitialSeconds: 900,
    timeIncrementSeconds: 10,
  },
  {
    id: "1day",
    label: "1 day / move",
    timeControlType: "correspondence",
    timePerMoveSeconds: 86400,
  },
];

export function presetById(id: PresetId): TimeControlPreset {
  const found = TIME_CONTROL_PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`unknown preset id: ${id}`);
  return found;
}
```

- [ ] **Step A3.4: Run test, confirm pass**

```bash
bunx vitest run lib/chess/time-controls.test.ts
```

Expected: green.

- [ ] **Step A3.5: Commit**

```bash
git add lib/chess/time-controls.ts lib/chess/time-controls.test.ts
git commit -m "$(cat <<'EOF'
feat(chess): time control presets (5: Untimed, 5min, 10min, 15+10, 1day)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task A4: Clock math + format

**Files:**
- Create: `lib/chess/clock.ts`
- Test: `lib/chess/clock.test.ts`

- [ ] **Step A4.1: Write failing tests**

`lib/chess/clock.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  computeRemaining,
  formatLive,
  formatCorrespondence,
  tickRateMs,
  LAG_CREDIT_MS,
} from "./clock";

describe("computeRemaining", () => {
  it("inactive side returns stored remaining unchanged", () => {
    const out = computeRemaining({
      remainingMs: 60_000,
      turnStartedAtMs: 0,
      nowMs: 30_000,
      isActive: false,
    });
    expect(out).toBe(60_000);
  });
  it("active side deducts elapsed minus lag credit", () => {
    const out = computeRemaining({
      remainingMs: 60_000,
      turnStartedAtMs: 0,
      nowMs: 5_000,
      isActive: true,
    });
    // 60_000 - 5_000 + 200 = 55_200
    expect(out).toBe(55_200);
  });
  it("clamps at 0 (never negative)", () => {
    const out = computeRemaining({
      remainingMs: 1_000,
      turnStartedAtMs: 0,
      nowMs: 10_000,
      isActive: true,
    });
    expect(out).toBe(0);
  });
  it("turn-started null treats as inactive (no math)", () => {
    const out = computeRemaining({
      remainingMs: 60_000,
      turnStartedAtMs: null,
      nowMs: 5_000,
      isActive: true,
    });
    expect(out).toBe(60_000);
  });
});

describe("formatLive", () => {
  it("MM:SS for >=10s", () => {
    expect(formatLive(125_000)).toBe("2:05");
    expect(formatLive(10_000)).toBe("0:10");
    expect(formatLive(600_000)).toBe("10:00");
  });
  it("M:SS.t for <10s", () => {
    expect(formatLive(9_999)).toBe("0:09.9");
    expect(formatLive(1_500)).toBe("0:01.5");
    expect(formatLive(0)).toBe("0:00.0");
  });
});

describe("formatCorrespondence", () => {
  it("Nd Hh for >1h", () => {
    expect(formatCorrespondence(86_400_000)).toBe("1d 0h");
    expect(formatCorrespondence(86_400_000 + 3_600_000 * 4)).toBe("1d 4h");
    expect(formatCorrespondence(3_600_000 + 1)).toBe("0d 1h");
  });
  it("MM:SS for <=1h", () => {
    expect(formatCorrespondence(3_600_000)).toBe("60:00");
    expect(formatCorrespondence(125_000)).toBe("2:05");
    expect(formatCorrespondence(0)).toBe("0:00");
  });
});

describe("tickRateMs", () => {
  it("untimed -> 0 (no tick)", () => {
    expect(tickRateMs("untimed", 1_000_000)).toBe(0);
  });
  it("live, >10s -> 1000ms", () => {
    expect(tickRateMs("live", 30_000)).toBe(1_000);
  });
  it("live, <=10s -> 100ms", () => {
    expect(tickRateMs("live", 9_000)).toBe(100);
  });
  it("correspondence -> 60000ms", () => {
    expect(tickRateMs("correspondence", 86_400_000)).toBe(60_000);
  });
});

describe("LAG_CREDIT_MS", () => {
  it("is 200", () => {
    expect(LAG_CREDIT_MS).toBe(200);
  });
});
```

- [ ] **Step A4.2: Run test, confirm fail**

```bash
bunx vitest run lib/chess/clock.test.ts
```

- [ ] **Step A4.3: Implement `lib/chess/clock.ts`**

```ts
export const LAG_CREDIT_MS = 200;

export type ClockMode = "untimed" | "live" | "correspondence";

export function computeRemaining(args: {
  remainingMs: number;
  turnStartedAtMs: number | null;
  nowMs: number;
  isActive: boolean;
}): number {
  const { remainingMs, turnStartedAtMs, nowMs, isActive } = args;
  if (!isActive || turnStartedAtMs === null) return remainingMs;
  const elapsed = nowMs - turnStartedAtMs;
  const adjusted = remainingMs - elapsed + LAG_CREDIT_MS;
  return adjusted > 0 ? adjusted : 0;
}

export function formatLive(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe >= 10_000) {
    const totalSec = Math.floor(safe / 1_000);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    return `${mm}:${ss.toString().padStart(2, "0")}`;
  }
  const totalTenths = Math.floor(safe / 100);
  const sec = Math.floor(totalTenths / 10);
  const tenth = totalTenths % 10;
  return `0:${sec.toString().padStart(2, "0")}.${tenth}`;
}

export function formatCorrespondence(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe > 3_600_000) {
    const days = Math.floor(safe / 86_400_000);
    const hours = Math.floor((safe % 86_400_000) / 3_600_000);
    return `${days}d ${hours}h`;
  }
  const totalSec = Math.floor(safe / 1_000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

export function tickRateMs(mode: ClockMode, displayedMs: number): number {
  if (mode === "untimed") return 0;
  if (mode === "correspondence") return 60_000;
  // live
  return displayedMs <= 10_000 ? 100 : 1_000;
}
```

- [ ] **Step A4.4: Run test, confirm pass**

```bash
bunx vitest run lib/chess/clock.test.ts
```

- [ ] **Step A4.5: Commit**

```bash
git add lib/chess/clock.ts lib/chess/clock.test.ts
git commit -m "$(cat <<'EOF'
feat(chess): clock math (compute/format/tick) with 200ms lag credit

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase B — RPCs

Same branch (`feat/clocks-schema-rpcs`).

### Task B1: Extend `create_game`

**Files:**
- Create: `supabase/migrations/<ts>_extend_create_game_for_clocks.sql`

- [ ] **Step B1.1: Generate migration**

```bash
supabase migration new extend_create_game_for_clocks
```

- [ ] **Step B1.2: Migration content**

```sql
-- M1.5++ — extend create_game to accept time control args
-- Spec: docs/superpowers/specs/2026-05-05-clocks-timeout-reconnect-design.md §5.1

set check_function_bodies = off;

create or replace function public.create_game(
  p_my_color text,
  p_time_control_type text default null,
  p_time_initial_seconds int default null,
  p_time_increment_seconds int default 0,
  p_time_per_move_seconds int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_game_id uuid;
  v_white_remaining_ms bigint;
  v_black_remaining_ms bigint;
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  if p_my_color not in ('white', 'black') then
    raise exception 'invalid_color' using errcode = 'P0001',
      detail = format('expected white|black, got %s', p_my_color);
  end if;

  -- Validate time control shape (mirrors table constraint).
  if p_time_control_type is not null and p_time_control_type not in ('live','correspondence') then
    raise exception 'invalid_time_control_type' using errcode = 'P0001';
  end if;

  if p_time_control_type = 'live' then
    if p_time_initial_seconds is null or p_time_initial_seconds <= 0 then
      raise exception 'invalid_time_control' using errcode = 'P0001',
        detail = 'live requires positive time_initial_seconds';
    end if;
    if p_time_per_move_seconds is not null then
      raise exception 'invalid_time_control' using errcode = 'P0001',
        detail = 'live cannot set time_per_move_seconds';
    end if;
    v_white_remaining_ms := p_time_initial_seconds * 1000;
    v_black_remaining_ms := p_time_initial_seconds * 1000;
  elsif p_time_control_type = 'correspondence' then
    if p_time_per_move_seconds is null or p_time_per_move_seconds <= 0 then
      raise exception 'invalid_time_control' using errcode = 'P0001',
        detail = 'correspondence requires positive time_per_move_seconds';
    end if;
    if p_time_initial_seconds is not null then
      raise exception 'invalid_time_control' using errcode = 'P0001',
        detail = 'correspondence cannot set time_initial_seconds';
    end if;
    v_white_remaining_ms := p_time_per_move_seconds * 1000;
    v_black_remaining_ms := p_time_per_move_seconds * 1000;
  else
    -- untimed
    v_white_remaining_ms := null;
    v_black_remaining_ms := null;
  end if;

  insert into public.games (
    id,
    white_id,
    black_id,
    current_fen,
    current_turn,
    ply,
    status,
    time_control_type,
    time_initial_seconds,
    time_increment_seconds,
    time_per_move_seconds,
    white_remaining_ms,
    black_remaining_ms
  )
  values (
    gen_random_uuid(),
    case when p_my_color = 'white' then v_caller else null end,
    case when p_my_color = 'black' then v_caller else null end,
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'w',
    0,
    'open',
    p_time_control_type,
    case when p_time_control_type = 'live' then p_time_initial_seconds else null end,
    case when p_time_control_type = 'live' then coalesce(p_time_increment_seconds, 0) else null end,
    case when p_time_control_type = 'correspondence' then p_time_per_move_seconds else null end,
    v_white_remaining_ms,
    v_black_remaining_ms
  )
  returning id into v_game_id;

  return v_game_id;
end;
$$;

revoke all on function public.create_game(text, text, int, int, int) from public, anon;
grant execute on function public.create_game(text, text, int, int, int) to authenticated;

-- Drop the old single-arg signature so callers must pass the new params.
drop function if exists public.create_game(text);

comment on function public.create_game(text, text, int, int, int) is
  'Create an open game with caller on requested side + time-control preset.';
```

- [ ] **Step B1.3: Apply + verify**

Apply via MCP `apply_migration` or `supabase db push`. Verify:

```sql
select pg_get_functiondef('public.create_game(text, text, int, int, int)'::regprocedure);
```

- [ ] **Step B1.4: Commit**

```bash
git add supabase/migrations/<ts>_extend_create_game_for_clocks.sql
git commit -m "$(cat <<'EOF'
feat(rpc): extend create_game to accept time control preset

Validates live/correspondence shape, seeds remaining_ms per side,
drops the old single-arg signature.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task B2: Extend `join_open_game` (set turn_started_at)

**Files:**
- Create: `supabase/migrations/<ts>_extend_join_open_game_for_clocks.sql`

- [ ] **Step B2.1: Generate**

```bash
supabase migration new extend_join_open_game_for_clocks
```

- [ ] **Step B2.2: Migration content**

```sql
-- M1.5++ — set turn_started_at when game flips to in_progress on join
-- Spec: docs/superpowers/specs/2026-05-05-clocks-timeout-reconnect-design.md §5.2

set check_function_bodies = off;

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
    status = 'in_progress',
    turn_started_at = now()  -- NEW: clock starts when both players present
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
```

- [ ] **Step B2.3: Apply, verify, commit**

```bash
git add supabase/migrations/<ts>_extend_join_open_game_for_clocks.sql
git commit -m "$(cat <<'EOF'
feat(rpc): join_open_game sets turn_started_at on flip to in_progress

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task B3: Extend `make_move` (lazy timeout + clock math)

**Files:**
- Create: `supabase/migrations/<ts>_extend_make_move_for_clocks.sql`

- [ ] **Step B3.1: Generate**

```bash
supabase migration new extend_make_move_for_clocks
```

- [ ] **Step B3.2: Migration content**

```sql
-- M1.5++ — make_move enforces deadline + applies clock math
-- Spec: docs/superpowers/specs/2026-05-05-clocks-timeout-reconnect-design.md §5.3

set check_function_bodies = off;

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
  v_active_remaining bigint;
  v_elapsed_ms bigint;
  v_new_active_remaining bigint;
  v_new_white_remaining bigint;
  v_new_black_remaining bigint;
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

  -- ---- Lazy timeout check + clock math (only for timed games) ----
  if g.time_control_type is not null and g.turn_started_at is not null then
    v_active_remaining := case g.current_turn
      when 'w' then g.white_remaining_ms
      else g.black_remaining_ms
    end;
    v_elapsed_ms := greatest(
      0,
      (extract(epoch from (now() - g.turn_started_at)) * 1000)::bigint - 200
    );

    if v_elapsed_ms > v_active_remaining then
      -- Timeout. First-move = abort, otherwise = timeout-loss.
      if g.ply = 0 then
        update public.games
        set status = 'aborted',
            termination_reason = 'abort',
            ended_at = now()
        where id = p_game_id
        returning * into g;
        return g;
      else
        update public.games
        set status = case g.current_turn when 'w' then 'black_won' else 'white_won' end,
            termination_reason = 'timeout',
            ended_at = now()
        where id = p_game_id
        returning * into g;
        return g;
      end if;
    end if;

    -- Not expired: deduct elapsed and (live only) add increment.
    v_new_active_remaining := v_active_remaining - v_elapsed_ms;
    if g.time_control_type = 'live' then
      v_new_active_remaining := v_new_active_remaining
        + coalesce(g.time_increment_seconds, 0) * 1000;
    end if;

    if g.current_turn = 'w' then
      v_new_white_remaining := v_new_active_remaining;
      -- Correspondence: newly-active side's clock resets to per-move budget.
      v_new_black_remaining := case g.time_control_type
        when 'correspondence' then g.time_per_move_seconds * 1000
        else g.black_remaining_ms
      end;
    else
      v_new_black_remaining := v_new_active_remaining;
      v_new_white_remaining := case g.time_control_type
        when 'correspondence' then g.time_per_move_seconds * 1000
        else g.white_remaining_ms
      end;
    end if;
  else
    -- Untimed: no clock math, no deadline check.
    v_new_white_remaining := g.white_remaining_ms;
    v_new_black_remaining := g.black_remaining_ms;
  end if;

  v_new_status := coalesce(p_terminal_status, 'in_progress');
  if v_new_status not in ('in_progress','white_won','black_won','draw') then
    raise exception 'invalid_terminal_status' using errcode = 'P0001';
  end if;

  v_termination_reason := case
    when v_new_status = 'white_won' or v_new_status = 'black_won' then 'checkmate'
    when v_new_status = 'draw' then 'stalemate'
    else null
  end;

  insert into public.game_moves (game_id, ply, san, uci, fen_after, played_by)
  values (p_game_id, g.ply + 1, p_san, p_uci, p_fen_after, v_caller);

  update public.games
  set
    ply = g.ply + 1,
    current_fen = p_fen_after,
    current_turn = case when g.current_turn = 'w' then 'b' else 'w' end,
    status = v_new_status,
    termination_reason = v_termination_reason,
    ended_at = case when v_new_status in ('white_won','black_won','draw') then now() else null end,
    white_remaining_ms = v_new_white_remaining,
    black_remaining_ms = v_new_black_remaining,
    turn_started_at = case
      when v_new_status = 'in_progress' and g.time_control_type is not null then now()
      else g.turn_started_at
    end
  where id = p_game_id
  returning * into g;

  return g;
end;
$$;
```

- [ ] **Step B3.3: Apply, verify, commit**

```bash
git add supabase/migrations/<ts>_extend_make_move_for_clocks.sql
git commit -m "$(cat <<'EOF'
feat(rpc): make_move enforces deadline + applies clock math

Lazy timeout check before move; deducts elapsed (with 200ms credit),
adds increment (live), resets per-move budget (correspondence). First-
move timeout maps to abort.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task B4: `claim_timeout` + `end_timeout` RPCs

**Files:**
- Create: `supabase/migrations/<ts>_claim_and_end_timeout_rpcs.sql`

- [ ] **Step B4.1: Generate**

```bash
supabase migration new claim_and_end_timeout_rpcs
```

- [ ] **Step B4.2: Migration content**

```sql
-- M1.5++ — claim_timeout (player/observer-callable) + end_timeout (service-role)
-- Spec: docs/superpowers/specs/2026-05-05-clocks-timeout-reconnect-design.md §5.4, §5.5

set check_function_bodies = off;

-- Internal helper: shared timeout-end logic, no caller checks.
create or replace function public._end_game_on_timeout(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
  v_active_remaining bigint;
  v_elapsed_ms bigint;
begin
  select * into g from public.games where id = p_game_id for update;

  if not found then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;

  if g.status <> 'in_progress' then
    -- Idempotent: already ended.
    return g;
  end if;

  if g.time_control_type is null or g.turn_started_at is null then
    raise exception 'untimed_game' using errcode = 'P0001';
  end if;

  v_active_remaining := case g.current_turn
    when 'w' then g.white_remaining_ms
    else g.black_remaining_ms
  end;
  v_elapsed_ms := greatest(
    0,
    (extract(epoch from (now() - g.turn_started_at)) * 1000)::bigint - 200
  );

  if v_elapsed_ms <= v_active_remaining then
    raise exception 'not_yet_expired' using errcode = 'P0001';
  end if;

  if g.ply = 0 then
    update public.games
    set status = 'aborted',
        termination_reason = 'abort',
        ended_at = now()
    where id = p_game_id
    returning * into g;
  else
    update public.games
    set status = case g.current_turn when 'w' then 'black_won' else 'white_won' end,
        termination_reason = 'timeout',
        ended_at = now()
    where id = p_game_id
    returning * into g;
  end if;

  return g;
end;
$$;

-- Player / observer claim. Auth required so we trust the caller's UID
-- isn't spoofed; the math is server-side either way.
create or replace function public.claim_timeout(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;
  return public._end_game_on_timeout(p_game_id);
end;
$$;

revoke all on function public.claim_timeout(uuid) from public, anon;
grant execute on function public.claim_timeout(uuid) to authenticated;

comment on function public.claim_timeout(uuid) is
  'Anyone authenticated can claim; server validates active-side deadline expired. ply=0 -> abort, else timeout-loss.';

-- Service-role / cron path. Same logic, no auth.uid() check.
create or replace function public.end_timeout(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
begin
  return public._end_game_on_timeout(p_game_id);
end;
$$;

revoke all on function public.end_timeout(uuid) from public, anon, authenticated;
grant execute on function public.end_timeout(uuid) to service_role;

comment on function public.end_timeout(uuid) is
  'Service-role only. Called by daily cron sweep; same math as claim_timeout but skips caller auth.';
```

- [ ] **Step B4.3: Apply, verify, commit**

```bash
git add supabase/migrations/<ts>_claim_and_end_timeout_rpcs.sql
git commit -m "$(cat <<'EOF'
feat(rpc): claim_timeout + end_timeout (cron) RPCs

Shared internal helper enforces deadline + ply=0->abort vs timeout-loss.
claim_timeout: any authenticated user (player or observer); idempotent.
end_timeout: service_role only, called by daily cron sweep.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task A+B: Open PR for Phases A + B

- [ ] **Step AB.1: Push branch + open PR**

```bash
git push -u origin feat/clocks-schema-rpcs
gh pr create --base dev --title "feat: M1.5++ clocks schema + RPCs" --body "$(cat <<'EOF'
## Summary
- Add clock columns to games (live + correspondence + untimed)
- Extend create_game / join_open_game / make_move RPCs
- New claim_timeout + end_timeout (service-role) RPCs
- Lib: time-control presets + clock math + Zod schemas

Spec: docs/superpowers/specs/2026-05-05-clocks-timeout-reconnect-design.md

## Test plan
- [ ] CI green (lint + typecheck + unit tests)
- [ ] Manual: create live game (5+0), play first move, verify clocks tick down + opponent inherits, increment of 0 lands fine
- [ ] Manual: create correspondence game (1d/move), verify per-move resets after move
- [ ] Manual: untimed game still plays end-to-end (M1 regression)
- [ ] Manual: legacy untimed games continue to work

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step AB.2: Wait for CI + merge**

```bash
gh pr checks --watch
gh pr merge --merge
git checkout dev
git pull origin dev
git branch -d feat/clocks-schema-rpcs
```

---

## Phase C — UI

Branch: `feat/clocks-ui` off `dev`.

### Task C1: TimeControlPicker

**Files:**
- Create: `app/games/new/TimeControlPicker.tsx`

- [ ] **Step C1.1: Branch**

```bash
git checkout -b feat/clocks-ui
```

- [ ] **Step C1.2: Implement component**

```tsx
"use client";

import { Label } from "@/components/ui/label";
import { TIME_CONTROL_PRESETS, type PresetId } from "@/lib/chess/time-controls";

type Props = {
  value: PresetId;
  onChange: (id: PresetId) => void;
  disabled?: boolean;
};

export function TimeControlPicker({ value, onChange, disabled }: Props) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Time control</legend>
      {TIME_CONTROL_PRESETS.map((p) => (
        <div key={p.id} className="flex items-center gap-2">
          <input
            type="radio"
            id={`tc-${p.id}`}
            name="timeControl"
            value={p.id}
            checked={value === p.id}
            onChange={() => onChange(p.id)}
            disabled={disabled}
          />
          <Label htmlFor={`tc-${p.id}`}>{p.label}</Label>
        </div>
      ))}
    </fieldset>
  );
}
```

- [ ] **Step C1.3: Commit**

```bash
git add app/games/new/TimeControlPicker.tsx
git commit -m "$(cat <<'EOF'
feat(ui): TimeControlPicker (5 presets)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task C2: Wire NewGameForm + createGame action

**Files:**
- Modify: `app/games/new/NewGameForm.tsx`
- Modify: `app/games/new/actions.ts`

- [ ] **Step C2.1: Update `actions.ts`**

Replace `createGame` body to pass time-control args:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateGameInputSchema, type ColorChoice } from "@/lib/schemas/game";
import { presetById, type PresetId } from "@/lib/chess/time-controls";

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

export async function createGame(
  input: { myColor: ColorChoice; presetId: PresetId },
): Promise<CreateGameError | never> {
  const preset = (() => {
    try {
      return presetById(input.presetId);
    } catch {
      return null;
    }
  })();
  if (!preset) {
    return { ok: false, code: "validation", message: "invalid preset" };
  }

  const parsed = CreateGameInputSchema.safeParse({
    myColor: input.myColor,
    timeControlType: preset.timeControlType ?? undefined,
    timeInitialSeconds: preset.timeInitialSeconds,
    timeIncrementSeconds: preset.timeIncrementSeconds,
    timePerMoveSeconds: preset.timePerMoveSeconds,
  });
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

  const { data, error } = await supabase.rpc("create_game", {
    p_my_color: resolved,
    p_time_control_type: parsed.data.timeControlType ?? null,
    p_time_initial_seconds: parsed.data.timeInitialSeconds ?? null,
    p_time_increment_seconds: parsed.data.timeIncrementSeconds ?? 0,
    p_time_per_move_seconds: parsed.data.timePerMoveSeconds ?? null,
  });
  if (error) {
    return { ok: false, code: "unknown", message: error.message };
  }

  const gameId = typeof data === "string" ? data : (data as { id?: string } | null)?.id;
  if (!gameId) {
    return { ok: false, code: "unknown", message: "no game id returned" };
  }

  redirect(`/games/${gameId}`);
}
```

- [ ] **Step C2.2: Update `NewGameForm.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createGame } from "./actions";
import { TimeControlPicker } from "./TimeControlPicker";
import type { ColorChoice } from "@/lib/schemas/game";
import type { PresetId } from "@/lib/chess/time-controls";

const CHOICES: { value: ColorChoice; label: string }[] = [
  { value: "white", label: "Play as white" },
  { value: "black", label: "Play as black" },
  { value: "random", label: "Random" },
];

export function NewGameForm() {
  const [choice, setChoice] = useState<ColorChoice>("random");
  const [preset, setPreset] = useState<PresetId>("10min");
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createGame({ myColor: choice, presetId: preset });
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

      <TimeControlPicker value={preset} onChange={setPreset} disabled={pending} />

      <Button type="submit" disabled={pending} size="lg">
        {pending ? "Creating…" : "Create game"}
      </Button>
    </form>
  );
}
```

- [ ] **Step C2.3: Verify**

```bash
bunx tsc --noEmit
bun run lint
```

- [ ] **Step C2.4: Commit**

```bash
git add app/games/new/NewGameForm.tsx app/games/new/actions.ts
git commit -m "$(cat <<'EOF'
feat(ui): wire TimeControlPicker into NewGameForm + createGame action

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task C3: Show time control on JoinGameForm

**Files:**
- Modify: `app/games/[gameId]/JoinGameForm.tsx`
- Modify: `app/games/[gameId]/page.tsx` (pass new props)

- [ ] **Step C3.1: Read existing JoinGameForm + page.tsx**

```bash
# (Read these files to confirm prop shapes before editing.)
```

- [ ] **Step C3.2: Update JoinGameForm to accept time-control props + render label**

Add props (`timeControlLabel: string | null`) and render a small line: `Time control: {label}` above the join button. If `null`, render `Untimed`.

```tsx
// Add to component props:
type Props = {
  gameId: string;
  timeControlLabel: string | null;
  // ...existing
};

// In render, near the join controls:
<p className="text-sm text-muted-foreground">
  Time control: <span className="font-medium">{timeControlLabel ?? "Untimed"}</span>
</p>
```

- [ ] **Step C3.3: Update page.tsx to fetch + format the label**

In the games SELECT, add: `time_control_type, time_initial_seconds, time_increment_seconds, time_per_move_seconds`. Add a small helper:

```ts
function formatTimeControlLabel(g: {
  time_control_type: string | null;
  time_initial_seconds: number | null;
  time_increment_seconds: number | null;
  time_per_move_seconds: number | null;
}): string | null {
  if (!g.time_control_type) return null;
  if (g.time_control_type === "live") {
    const minutes = Math.round((g.time_initial_seconds ?? 0) / 60);
    const inc = g.time_increment_seconds ?? 0;
    return inc > 0 ? `${minutes} + ${inc}` : `${minutes} min`;
  }
  // correspondence
  const days = Math.round((g.time_per_move_seconds ?? 0) / 86_400);
  return days >= 1 ? `${days} day/move` : `${(g.time_per_move_seconds ?? 0)}s/move`;
}

// Pass `timeControlLabel={formatTimeControlLabel(game)}` to JoinGameForm.
```

- [ ] **Step C3.4: Verify + commit**

```bash
bunx tsc --noEmit
bun run lint
git add app/games/[gameId]/JoinGameForm.tsx app/games/[gameId]/page.tsx
git commit -m "$(cat <<'EOF'
feat(ui): show time control on join screen

Joiner sees the format before committing. No negotiate path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task C4: Clock component

**Files:**
- Create: `app/games/[gameId]/Clock.tsx`

- [ ] **Step C4.1: Implement**

```tsx
"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  computeRemaining,
  formatLive,
  formatCorrespondence,
  tickRateMs,
  type ClockMode,
} from "@/lib/chess/clock";

type Props = {
  side: "white" | "black";
  mode: ClockMode;
  remainingMs: number | null;
  turnStartedAt: string | null;
  isActive: boolean;
};

export function Clock({ mode, remainingMs, turnStartedAt, isActive }: Props) {
  if (mode === "untimed" || remainingMs === null) {
    return null;
  }

  const turnStartedAtMs = turnStartedAt ? new Date(turnStartedAt).getTime() : null;
  const [now, setNow] = useState<number>(() => Date.now());

  // Re-snap when props change (server pushed new row).
  useEffect(() => {
    setNow(Date.now());
  }, [remainingMs, turnStartedAt, isActive]);

  // Local tick. Untimed already returned above.
  useEffect(() => {
    const displayed = computeRemaining({
      remainingMs,
      turnStartedAtMs,
      nowMs: now,
      isActive,
    });
    const rate = tickRateMs(mode, displayed);
    if (rate === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), rate);
    return () => window.clearInterval(id);
  }, [mode, remainingMs, turnStartedAtMs, isActive, now]);

  const displayed = computeRemaining({
    remainingMs,
    turnStartedAtMs,
    nowMs: now,
    isActive,
  });

  const text =
    mode === "correspondence" ? formatCorrespondence(displayed) : formatLive(displayed);

  const lowTime = mode === "live" && displayed <= 30_000;

  return (
    <div
      className={cn(
        "rounded border px-3 py-2 font-mono text-lg tabular-nums",
        isActive ? "ring-2 ring-amber-400" : "opacity-60",
        lowTime && isActive && "text-red-600 animate-pulse",
      )}
      data-testid="clock"
      data-side={undefined /* set by parent if needed */}
      data-active={isActive ? "true" : "false"}
      data-displayed-ms={displayed}
    >
      {text}
    </div>
  );
}
```

- [ ] **Step C4.2: Verify + commit**

```bash
bunx tsc --noEmit
bun run lint
git add app/games/[gameId]/Clock.tsx
git commit -m "$(cat <<'EOF'
feat(ui): Clock component (live + correspondence) with local interpolation

Re-snaps on server push, ticks at mode-appropriate rate, low-time pulse
under 30s for live games.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task C5: useAutoClaim hook + claimTimeout server action

**Files:**
- Create: `app/games/[gameId]/useAutoClaim.ts`
- Modify: `app/games/[gameId]/actions.ts`

- [ ] **Step C5.1: Add `claimTimeout` to actions.ts**

Append to the file:

```ts
export type ClaimTimeoutErrorCode =
  | "validation"
  | "unauthenticated"
  | "game_not_found"
  | "not_yet_expired"
  | "untimed_game"
  | "unknown";

export type ClaimTimeoutOutcome =
  | { ok: true }
  | { ok: false; code: ClaimTimeoutErrorCode; message: string };

function mapClaimTimeoutPgError(msg: string): ClaimTimeoutErrorCode {
  if (msg.includes("not_yet_expired")) return "not_yet_expired";
  if (msg.includes("untimed_game")) return "untimed_game";
  if (msg.includes("game_not_found")) return "game_not_found";
  if (msg.includes("unauthenticated")) return "unauthenticated";
  return "unknown";
}

export async function claimTimeout(input: { gameId: string }): Promise<ClaimTimeoutOutcome> {
  if (typeof input?.gameId !== "string" || input.gameId.length === 0) {
    return { ok: false, code: "validation", message: "gameId required" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: "unauthenticated", message: "not signed in" };
  }

  const { error } = await supabase.rpc("claim_timeout", { p_game_id: input.gameId });
  if (error) {
    return { ok: false, code: mapClaimTimeoutPgError(error.message), message: error.message };
  }

  return { ok: true };
}
```

- [ ] **Step C5.2: Implement `useAutoClaim.ts`**

```ts
"use client";

import { useEffect, useRef } from "react";
import { claimTimeout } from "./actions";
import {
  computeRemaining,
  type ClockMode,
} from "@/lib/chess/clock";

type Args = {
  gameId: string;
  mode: ClockMode;
  status: string;
  /** Opponent's stored remaining ms (the side currently to move that I'm waiting on). */
  opponentRemainingMs: number | null;
  /** turn_started_at as ISO string. */
  turnStartedAt: string | null;
  /** Whether the opponent is the active side (true if it's their turn, not mine). */
  opponentIsActive: boolean;
};

const DEBOUNCE_MS = 1_000;

export function useAutoClaim({
  gameId,
  mode,
  status,
  opponentRemainingMs,
  turnStartedAt,
  opponentIsActive,
}: Args) {
  const fired = useRef(false);

  useEffect(() => {
    if (status !== "in_progress") return;
    if (mode === "untimed") return;
    if (!opponentIsActive) return;
    if (opponentRemainingMs === null) return;

    fired.current = false;

    const check = () => {
      const turnStartedAtMs = turnStartedAt ? new Date(turnStartedAt).getTime() : null;
      const remaining = computeRemaining({
        remainingMs: opponentRemainingMs,
        turnStartedAtMs,
        nowMs: Date.now(),
        isActive: true,
      });
      if (remaining <= 0 && !fired.current) {
        fired.current = true;
        window.setTimeout(async () => {
          const result = await claimTimeout({ gameId });
          if (!result.ok && result.code === "not_yet_expired") {
            // Allow another check cycle.
            fired.current = false;
          }
        }, DEBOUNCE_MS);
      }
    };

    check();
    const id = window.setInterval(check, 500);
    return () => window.clearInterval(id);
  }, [gameId, mode, status, opponentRemainingMs, turnStartedAt, opponentIsActive]);
}
```

- [ ] **Step C5.3: Verify + commit**

```bash
bunx tsc --noEmit
bun run lint
git add app/games/[gameId]/useAutoClaim.ts app/games/[gameId]/actions.ts
git commit -m "$(cat <<'EOF'
feat(ui): claimTimeout action + useAutoClaim hook

Auto-fires claim_timeout when opponent's interpolated clock hits 0
(1s debounce). Resets on not_yet_expired so client can retry.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task C6: Wire Clocks + auto-claim into GameClient

**Files:**
- Modify: `app/games/[gameId]/GameClient.tsx`
- Modify: `app/games/[gameId]/page.tsx`

- [ ] **Step C6.1: Update page.tsx to fetch new fields and pass them**

Extend the games SELECT to include: `time_control_type, time_initial_seconds, time_increment_seconds, time_per_move_seconds, white_remaining_ms, black_remaining_ms, turn_started_at`.

Pass to `GameClient`:

```tsx
<GameClient
  // …existing props
  timeControlType={game.time_control_type}
  initialWhiteRemainingMs={game.white_remaining_ms}
  initialBlackRemainingMs={game.black_remaining_ms}
  initialTurnStartedAt={game.turn_started_at}
/>
```

- [ ] **Step C6.2: Update GameClient.tsx**

Add to `Props`:

```tsx
type Props = {
  // …existing
  timeControlType: "live" | "correspondence" | null;
  initialWhiteRemainingMs: number | null;
  initialBlackRemainingMs: number | null;
  initialTurnStartedAt: string | null;
};
```

Extend `State`:

```tsx
type State = {
  // …existing
  whiteRemainingMs: number | null;
  blackRemainingMs: number | null;
  turnStartedAt: string | null;
};
```

Initialize from props. In the realtime status subscription callback, also accept + apply the new fields when they arrive (the `subscribeToGameStatus` callback payload will need the new columns — see Step C6.3).

Render two `Clock` instances inside the existing pill row (replace placeholder if any):

```tsx
import { Clock } from "./Clock";
import { useAutoClaim } from "./useAutoClaim";
import type { ClockMode } from "@/lib/chess/clock";

// Inside component, after existing state derivations:
const mode: ClockMode = timeControlType ?? "untimed";

// Determine which side I'm waiting on (their clock matters for auto-claim).
const opponentSide = myColor === "w" ? "b" : myColor === "b" ? "w" : null;
const opponentRemainingMs =
  opponentSide === "w" ? state.whiteRemainingMs
  : opponentSide === "b" ? state.blackRemainingMs
  : null;
const opponentIsActive = inProgress && (
  (opponentSide === "w" && isWhitesTurn) ||
  (opponentSide === "b" && !isWhitesTurn)
);

useAutoClaim({
  gameId,
  mode,
  status: state.status,
  opponentRemainingMs,
  turnStartedAt: state.turnStartedAt,
  opponentIsActive,
});

// In sidebar, render a Clock per side (e.g., next to player pill):
const renderClock = (side: "w" | "b") => (
  <Clock
    side={side === "w" ? "white" : "black"}
    mode={mode}
    remainingMs={side === "w" ? state.whiteRemainingMs : state.blackRemainingMs}
    turnStartedAt={state.turnStartedAt}
    isActive={inProgress && (side === "w" ? isWhitesTurn : !isWhitesTurn)}
  />
);
```

Slot the clocks above + below the board (or alongside the player pills). Keep the existing layout; clocks render `null` for untimed games so existing layout shouldn't shift much for legacy games.

- [ ] **Step C6.3: Update `subscribeToGameStatus` to surface new fields**

Read `lib/realtime/subscribe.ts`. The callback payload likely already passes the entire row update. If it filters fields, extend the callback type to include the new columns. Apply through new `applyClockState` reducer in GameClient that merges into State.

```ts
// In GameClient.tsx
const applyClockState = useCallback(
  (clock: {
    whiteRemainingMs: number | null;
    blackRemainingMs: number | null;
    turnStartedAt: string | null;
  }) => {
    setState((prev) => ({
      ...prev,
      whiteRemainingMs: clock.whiteRemainingMs,
      blackRemainingMs: clock.blackRemainingMs,
      turnStartedAt: clock.turnStartedAt,
    }));
  },
  [],
);
```

Wire from the existing `subscribeToGameStatus` callback (or add a new subscription).

- [ ] **Step C6.4: Lock move UI when own clock is 0**

In `isDraggablePiece` and `onSquareClick` / `onPieceDrop` early-returns, add a check: if mode is timed AND my-side's interpolated remaining ≤ 0, disable. Example:

```ts
const myRemainingMs =
  myColor === "w" ? state.whiteRemainingMs
  : myColor === "b" ? state.blackRemainingMs
  : null;
const myIsActive = myTurn;
const myDisplayedMs = myRemainingMs !== null
  ? computeRemaining({
      remainingMs: myRemainingMs,
      turnStartedAtMs: state.turnStartedAt ? new Date(state.turnStartedAt).getTime() : null,
      nowMs: Date.now(),
      isActive: myIsActive,
    })
  : null;
const myClockExpired = mode !== "untimed" && myDisplayedMs !== null && myDisplayedMs <= 0;
```

In `isDraggablePiece` and other gates, return `false` if `myClockExpired`. NB: this is informational only — a stale frame can't bypass server enforcement.

- [ ] **Step C6.5: Verify + commit**

```bash
bunx tsc --noEmit
bun run lint
git add app/games/[gameId]/GameClient.tsx app/games/[gameId]/page.tsx
git commit -m "$(cat <<'EOF'
feat(ui): wire Clocks + auto-claim into GameClient

Two Clock instances (white + black) render in the player pill row.
useAutoClaim fires claim_timeout when opponent clock hits 0. Move UI
locks when own interpolated clock <= 0.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task C7: Time-control badge in games directory

**Files:**
- Modify: `app/games/page.tsx`

- [ ] **Step C7.1: Extend the games SELECT to include time_control_type + supporting columns**

Inside the page's data fetch:

```ts
.select(
  "id, status, white_id, black_id, current_turn, ply, ended_at, termination_reason, time_control_type, time_initial_seconds, time_increment_seconds, time_per_move_seconds"
)
```

- [ ] **Step C7.2: Render small badge per row**

Reuse the same `formatTimeControlLabel` helper from C3.3 (extract to a shared module or duplicate inline; prefer shared at `lib/chess/time-controls.ts`):

```ts
// lib/chess/time-controls.ts (append)
export function formatTimeControlLabel(g: {
  time_control_type: string | null;
  time_initial_seconds: number | null;
  time_increment_seconds: number | null;
  time_per_move_seconds: number | null;
}): string {
  if (!g.time_control_type) return "Untimed";
  if (g.time_control_type === "live") {
    const minutes = Math.round((g.time_initial_seconds ?? 0) / 60);
    const inc = g.time_increment_seconds ?? 0;
    return inc > 0 ? `${minutes} + ${inc}` : `${minutes} min`;
  }
  const days = Math.round((g.time_per_move_seconds ?? 0) / 86_400);
  return days >= 1 ? `${days} day/move` : `${(g.time_per_move_seconds ?? 0)}s/move`;
}
```

Use in the game-row JSX:

```tsx
<span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
  {formatTimeControlLabel(g)}
</span>
```

- [ ] **Step C7.3: Replace the local helper in step C3.3 with the shared one**

In `app/games/[gameId]/page.tsx`, replace its local `formatTimeControlLabel` with an import from `@/lib/chess/time-controls`. Keep behavior identical.

- [ ] **Step C7.4: Verify + commit**

```bash
bunx tsc --noEmit
bun run lint
git add app/games/page.tsx app/games/[gameId]/page.tsx lib/chess/time-controls.ts
git commit -m "$(cat <<'EOF'
feat(ui): time-control badge in games directory

Shared formatTimeControlLabel helper in lib/chess/time-controls.ts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task C: Open PR for Phase C

- [ ] **Step CX.1: Push + PR**

```bash
git push -u origin feat/clocks-ui
gh pr create --base dev --title "feat: M1.5++ clocks UI" --body "$(cat <<'EOF'
## Summary
- TimeControlPicker on game-create
- Clock component (live + correspondence) with local interpolation
- useAutoClaim hook + claimTimeout server action
- GameClient renders Clocks + locks move UI on own-clock zero
- JoinGameForm + games directory show time control

Spec: docs/superpowers/specs/2026-05-05-clocks-timeout-reconnect-design.md

## Test plan
- [ ] CI green
- [ ] Two browsers, 5+0 game, both move, increments + decrements visible
- [ ] Two browsers, 1d/move correspondence game, both move, per-move resets visible
- [ ] Two browsers, untimed game, no clocks render, no math runs
- [ ] One browser lets clock hit 0, other browser auto-claims, end-state banner shows timeout

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step CX.2: Wait + merge**

```bash
gh pr checks --watch
gh pr merge --merge
git checkout dev && git pull origin dev
git branch -d feat/clocks-ui
```

---

## Phase D — Cron + ops

Branch: `feat/clocks-cron-sweep` off `dev`.

### Task D1: Cron route

**Files:**
- Create: `app/api/cron/timeout-sweep/route.ts`

- [ ] **Step D1.1: Branch**

```bash
git checkout -b feat/clocks-cron-sweep
```

- [ ] **Step D1.2: Implement route**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

const LAG_CREDIT_MS = 200;

type Candidate = {
  id: string;
  current_turn: "w" | "b";
  ply: number;
  turn_started_at: string | null;
  white_remaining_ms: number | null;
  black_remaining_ms: number | null;
  time_control_type: "live" | "correspondence" | null;
  time_per_move_seconds: number | null;
};

function isExpired(g: Candidate): boolean {
  if (!g.turn_started_at) return false;
  const activeRemaining =
    g.current_turn === "w" ? g.white_remaining_ms : g.black_remaining_ms;
  if (activeRemaining === null) return false;
  const elapsed = Math.max(
    0,
    Date.now() - new Date(g.turn_started_at).getTime() - LAG_CREDIT_MS,
  );
  return elapsed > activeRemaining;
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: candidates, error } = await supabase
    .from("games")
    .select(
      "id, current_turn, ply, turn_started_at, white_remaining_ms, black_remaining_ms, time_control_type, time_per_move_seconds",
    )
    .eq("status", "in_progress")
    .not("time_control_type", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let ended = 0;
  const failures: Array<{ id: string; reason: string }> = [];

  for (const g of (candidates ?? []) as Candidate[]) {
    if (!isExpired(g)) continue;
    const { error: rpcError } = await supabase.rpc("end_timeout", {
      p_game_id: g.id,
    });
    if (rpcError) {
      failures.push({ id: g.id, reason: rpcError.message });
      continue;
    }
    ended++;
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates?.length ?? 0,
    ended,
    failures,
  });
}
```

- [ ] **Step D1.3: Verify**

```bash
bunx tsc --noEmit
bun run lint
```

- [ ] **Step D1.4: Commit**

```bash
git add app/api/cron/timeout-sweep/route.ts
git commit -m "$(cat <<'EOF'
feat(cron): timeout-sweep route (daily Vercel Cron)

Service-role client; iterates in_progress timed games, ends each whose
deadline expired via end_timeout RPC. Returns counts + failures.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task D2: vercel.json + env doc

**Files:**
- Modify: `vercel.json`
- Modify: `.env.example`

- [ ] **Step D2.1: Update `vercel.json`**

Replace the existing minimal file with:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/timeout-sweep",
      "schedule": "0 4 * * *"
    }
  ]
}
```

- [ ] **Step D2.2: Update `.env.example`**

Append (or insert if section exists):

```env
# Required by /api/cron/timeout-sweep — Vercel auto-injects on cron triggers
# in production, but include locally if you intend to curl the endpoint.
CRON_SECRET=
```

- [ ] **Step D2.3: Set production + preview-dev envs**

(User-side action; document below the env entry.) In Vercel dashboard or via CLI:

```bash
vercel env add CRON_SECRET production
vercel env add CRON_SECRET preview
# Paste the same random 32+ char string for both. Local: set in .env.local
```

- [ ] **Step D2.4: Manual smoke against preview**

Once a preview deployment is live:

```bash
curl -i "https://<preview-domain>/api/cron/timeout-sweep" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected: 200 with JSON `{ "ok": true, "candidates": N, "ended": M, "failures": [] }`.

- [ ] **Step D2.5: Commit**

```bash
git add vercel.json .env.example
git commit -m "$(cat <<'EOF'
chore(cron): wire timeout-sweep into vercel.json + document CRON_SECRET

Daily at 04:00 UTC. Set CRON_SECRET in Vercel env (production + preview)
manually before merge.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task D: Open PR for Phase D

- [ ] **Step DX.1: Push + PR**

```bash
git push -u origin feat/clocks-cron-sweep
gh pr create --base dev --title "feat: M1.5++ daily timeout sweep cron" --body "$(cat <<'EOF'
## Summary
- /api/cron/timeout-sweep route (service-role; iterates in_progress timed games; calls end_timeout RPC)
- vercel.json: crons entry, daily 04:00 UTC
- .env.example: CRON_SECRET documented

Spec: docs/superpowers/specs/2026-05-05-clocks-timeout-reconnect-design.md

## Test plan
- [ ] CI green
- [ ] CRON_SECRET set in Vercel production + preview envs (manual)
- [ ] curl preview /api/cron/timeout-sweep with bearer; observes 200 + counts JSON
- [ ] Manually create live game, let both browsers go offline, wait until 04:00 UTC sweep (or trigger via Vercel CLI), verify game ends with timeout termination

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step DX.2: Wait + merge**

```bash
gh pr checks --watch
gh pr merge --merge
git checkout dev && git pull origin dev
git branch -d feat/clocks-cron-sweep
```

---

## Phase E — E2E

Branch: `feat/clocks-e2e` off `dev`.

### Task E1: Live clock spec

**Files:**
- Create: `tests/e2e/clocks-live.spec.ts`

- [ ] **Step E1.1: Branch**

```bash
git checkout -b feat/clocks-e2e
```

- [ ] **Step E1.2: Inspect existing e2e helpers**

```bash
# Confirm helpers / fixtures
```

```ts
// Read tests/e2e/* to learn the fixture pattern + login helper.
```

- [ ] **Step E1.3: Write test**

```ts
import { expect, test } from "@playwright/test";
import { signUpAndLogin, openTwoBrowsers } from "./helpers/auth"; // adapt to actual helpers

test("5+0 live clocks tick + opponent's clock starts on white's first move", async ({ browser }) => {
  const [whiteCtx, blackCtx] = await openTwoBrowsers(browser);
  await signUpAndLogin(whiteCtx, "white");
  await signUpAndLogin(blackCtx, "black");

  // White creates 5+0 game.
  await whiteCtx.page.goto("/games/new");
  await whiteCtx.page.getByLabel("Play as white").check();
  await whiteCtx.page.getByLabel("5 min").check();
  await whiteCtx.page.getByRole("button", { name: /create game/i }).click();
  await whiteCtx.page.waitForURL(/\/games\/[\w-]+/);
  const gameUrl = whiteCtx.page.url();

  // Black joins.
  await blackCtx.page.goto(gameUrl);
  await blackCtx.page.getByRole("button", { name: /join/i }).click();

  // Both clocks present + ~5:00. White is active.
  const whiteClockOnWhite = whiteCtx.page.getByTestId("clock").first();
  await expect(whiteClockOnWhite).toContainText("5:00");

  // Wait 2 seconds, white's display drops below 5:00.
  await whiteCtx.page.waitForTimeout(2000);
  await expect(whiteClockOnWhite).not.toContainText("5:00");

  // White makes a move (helper: drag e2-e4 or call SmokeFoolsMate? choose a stable helper).
  await whiteCtx.page.evaluate(() => {
    // Use the existing smoke harness or expose a window helper.
    // If not available, drive via @playwright/test board interactions.
  });
  // (Implementation detail: e2 -> e4. Use the existing pattern from tests/e2e/board.spec.ts.)

  // After white's move, black's clock now starts from ~5:00 and decrements.
  const blackClockOnBlack = blackCtx.page.getByTestId("clock").nth(1);
  await expect(blackClockOnBlack).toContainText(/[45]:\d{2}/);
});
```

> **Note:** the exact selectors / helpers depend on the existing e2e harness. Adapt to whichever fixture pattern is in place. The intent is: assert clocks render, decrement actively, and switch on move.

- [ ] **Step E1.4: Run + iterate**

```bash
bunx playwright test tests/e2e/clocks-live.spec.ts
```

- [ ] **Step E1.5: Commit**

```bash
git add tests/e2e/clocks-live.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): live 5+0 clock tick + handoff on move

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task E2: Correspondence clock spec

**Files:**
- Create: `tests/e2e/clocks-correspondence.spec.ts`

- [ ] **Step E2.1: Write test**

```ts
import { expect, test } from "@playwright/test";
import { signUpAndLogin, openTwoBrowsers } from "./helpers/auth";

test("1 day/move correspondence: clock shows days/hours; resets on move", async ({ browser }) => {
  const [whiteCtx, blackCtx] = await openTwoBrowsers(browser);
  await signUpAndLogin(whiteCtx, "white-corr");
  await signUpAndLogin(blackCtx, "black-corr");

  await whiteCtx.page.goto("/games/new");
  await whiteCtx.page.getByLabel("Play as white").check();
  await whiteCtx.page.getByLabel("1 day / move").check();
  await whiteCtx.page.getByRole("button", { name: /create game/i }).click();
  await whiteCtx.page.waitForURL(/\/games\/[\w-]+/);
  const gameUrl = whiteCtx.page.url();

  await blackCtx.page.goto(gameUrl);
  await blackCtx.page.getByRole("button", { name: /join/i }).click();

  const whiteClock = whiteCtx.page.getByTestId("clock").first();
  await expect(whiteClock).toContainText("1d 0h");

  // White makes any legal move (use existing helper).
  // After: white's clock should re-render at "1d 0h" again (reset to per-move budget when their next turn comes — but white is no longer active, so display freezes at remaining minus 0).
  // black's clock should now show "1d 0h" (fresh per-move budget) and tick down.
  await blackCtx.page.waitForTimeout(500);
  const blackClock = blackCtx.page.getByTestId("clock").nth(1);
  await expect(blackClock).toContainText("1d 0h");
});
```

- [ ] **Step E2.2: Run + commit**

```bash
bunx playwright test tests/e2e/clocks-correspondence.spec.ts
git add tests/e2e/clocks-correspondence.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): correspondence 1-day/move clock display + per-move reset

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task E3: Timeout claim spec

**Files:**
- Create: `tests/e2e/clocks-timeout.spec.ts`

- [ ] **Step E3.1: Write test**

```ts
import { expect, test } from "@playwright/test";
import { signUpAndLogin, openTwoBrowsers } from "./helpers/auth";

// Use a tiny sub-1-min preset only available at game-create through env override,
// OR drive via a server-action helper that creates a game with arbitrary remaining_ms
// for test purposes. Easiest: create a 5min game and patch the remaining_ms via
// Supabase service-role helper in test setup so white starts with ~3 seconds.

test("white runs clock to 0; black auto-claims; status flips to black_won timeout", async ({ browser }) => {
  const [whiteCtx, blackCtx] = await openTwoBrowsers(browser);
  await signUpAndLogin(whiteCtx, "white-to");
  await signUpAndLogin(blackCtx, "black-to");

  // Create a 5min game then patch white's remaining_ms to 3000 via test-setup
  // helper (use service-role client in tests/e2e/helpers/db.ts).
  const gameId = await testSetup_createGameWithRemaining({
    whiteUserId: whiteCtx.userId,
    blackUserId: blackCtx.userId,
    presetId: "5min",
    whiteRemainingMs: 3_000,
  });

  await whiteCtx.page.goto(`/games/${gameId}`);
  await blackCtx.page.goto(`/games/${gameId}`);

  // White intentionally does nothing; ~3s later interpolation hits 0.
  // Black's auto-claim fires after the 1s debounce.
  await blackCtx.page.waitForTimeout(5_000);

  // Black sees end-state banner.
  await expect(blackCtx.page.getByText(/(time'?s up|timeout|black wins)/i)).toBeVisible();

  // White also sees the same flip via realtime.
  await expect(whiteCtx.page.getByTestId("game-state")).toHaveAttribute("data-status", "black_won");
});
```

> **Note:** `testSetup_createGameWithRemaining` is a test-only helper at `tests/e2e/helpers/db.ts`. It uses a service-role Supabase client to: call `create_game` then patch `white_remaining_ms` directly (RLS bypass) so the test can drive a near-zero clock without waiting 5 minutes. Add this helper as part of the task.

- [ ] **Step E3.2: Implement test helper**

Append to (or create) `tests/e2e/helpers/db.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

export async function testSetup_createGameWithRemaining(args: {
  whiteUserId: string;
  blackUserId: string;
  presetId: "5min" | "10min" | "15+10";
  whiteRemainingMs: number;
}) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  // Ladder of RPCs — depends on existing test fixture API.
  // Pseudocode: create game as white, join as black, patch.
  // Implementation lives in tests; left as a fill-in for the engineer
  // to align with existing helpers.
  // …
  throw new Error("implement against existing test fixture API");
}
```

> **Note:** depending on how the existing e2e harness opens browsers + signs up, the helper may already exist under a different name. Reuse first, add only if missing.

- [ ] **Step E3.3: Run + iterate**

```bash
bunx playwright test tests/e2e/clocks-timeout.spec.ts
```

- [ ] **Step E3.4: Commit**

```bash
git add tests/e2e/clocks-timeout.spec.ts tests/e2e/helpers/db.ts
git commit -m "$(cat <<'EOF'
test(e2e): timeout claim flow + reconnect via patched-clock fixture

Test helper patches white_remaining_ms to a small value via service-role
so the e2e doesn't have to wait the full preset duration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task E: Open PR for Phase E

- [ ] **Step EX.1: Push + PR**

```bash
git push -u origin feat/clocks-e2e
gh pr create --base dev --title "test: M1.5++ clocks e2e specs" --body "$(cat <<'EOF'
## Summary
- e2e: live (5+0) clocks tick + handoff
- e2e: correspondence (1d/move) display + per-move reset
- e2e: timeout claim flow with patched-clock fixture

Spec: docs/superpowers/specs/2026-05-05-clocks-timeout-reconnect-design.md

## Test plan
- [ ] CI green (Playwright + lint + typecheck)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step EX.2: Wait + merge**

```bash
gh pr checks --watch
gh pr merge --merge
git checkout dev && git pull origin dev
git branch -d feat/clocks-e2e
```

---

## Final ship — `dev` → `main`

After all four PRs merged into `dev`:

- [ ] **Step ship.1: Verify dev is content-ready**

```bash
git checkout dev
git pull origin dev
git diff main..dev -- :^docs/ :^wiki/ :^.claude/ | head
```

- [ ] **Step ship.2: Open ship PR**

```bash
gh pr create --base main --head dev --title "ship: M1.5++ clocks, timeout, reconnect" --body "$(cat <<'EOF'
## Summary
M1.5++ ship — clocks (live + correspondence) + timeout detection (lazy + auto-claim + daily cron sweep) + strict reconnect policy.

PR fan-out from dev:
- #<A+B>: schema + RPCs
- #<C>: UI
- #<D>: cron
- #<E>: e2e

## Test plan
- [ ] All four `dev` PRs merged + CI green
- [ ] Production deploy: 5+0 live game between two browsers, clocks visible + decrementing
- [ ] Production deploy: 1d/move correspondence visible + decrementing
- [ ] Production deploy: untimed games still work (M1 regression)
- [ ] CRON_SECRET configured in Vercel production env

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step ship.3: Squash to main**

```bash
gh pr checks --watch
gh pr merge --squash
```

- [ ] **Step ship.4: Update wiki/memory**

- Update `wiki/projects/narrative-chess-v2.md` Status section (M1.5++ shipped, squash SHA).
- Update `.claude/memory/general.md` ship facts.
- Add lesson notes in `wiki/notes/lesson-*.md` for anything surprising.
- Mark Polish A/B/C tasks as ready to start.

---

## Self-review notes (carried inline)

- Spec §4 schema migration matches Task A1.
- Spec §5.1 (create_game) → Task B1.
- Spec §5.2 (join_open_game) → Task B2.
- Spec §5.3 (make_move lazy + math) → Task B3.
- Spec §5.4 (claim_timeout) + §5.5 (end_timeout) → Task B4.
- Spec §6.1 (TimeControlPicker) → Task C1.
- Spec §6.2 (Clock) → Task C4.
- Spec §6.3 (auto-claim) → Task C5.
- Spec §6.4 (placement) → Task C6.
- Spec §6.5 (updated existing components) → Tasks C2, C3, C6, C7.
- Spec §7 (cron) → Tasks D1, D2.
- Spec §8 (data flow) → covered implicitly via tasks above.
- Spec §9 (errors) → handled in RPCs (B-tasks) + server actions (C5) + Clock + auto-claim debounce (C5).
- Spec §10.1 (unit) → Tasks A2, A3, A4.
- Spec §10.2 (integration) → covered by RPC migrations + manual SQL after each apply (could be expanded into pgTAP if desired; for M1.5++ scope we lean on e2e instead).
- Spec §10.3 (e2e) → Tasks E1, E2, E3.
- Spec §10.4 (manual cron smoke) → Step D2.4.
- Spec §10.5 (RLS gate) → Step A1.5.
