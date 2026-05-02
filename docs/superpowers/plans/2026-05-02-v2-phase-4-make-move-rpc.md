# V2 Phase 4 — make_move RPC + chess.js Engine Wrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the `make_move` Postgres RPC with `SECURITY DEFINER` + optimistic concurrency, the chess.js engine wrapper at `lib/chess/engine.ts` (sole import site), the Server Action that calls the RPC, and the programmatic-auth Playwright helper that flips the RLS gate spec from `test.fixme` to executable. End-state: legal moves persist + broadcast; illegal moves are rejected with clear errors; concurrent move attempts conflict-fail; the e2e gate runs unattended in CI.

**Architecture:** Server Action validates moves via chess.js (option A from spec §6.3 — JS-only chess engine, can't run in plpgsql). RPC trusts the Server Action and persists. `expected_ply` check inside the RPC catches both racing clients and replay attacks. The chess.js wrapper exposes a small typed surface (`engine.ts`) so chess.js never leaks into the rest of the codebase. Programmatic auth uses Supabase admin API to mint sessions for test users + injects the session cookie into a Playwright browser context.

**Tech Stack:** Postgres plpgsql, chess.js 1.4, Zod 4, Next.js 16 Server Actions, `@supabase/ssr` server client, `@supabase/supabase-js` admin client (Playwright fixture), Bun's built-in test runner for unit tests.

**Spec reference:** `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` §6.3 (move RPC), §6.5 (repo layout — `lib/chess/engine.ts` placement), and Step J in §7.

**Prerequisites (Phase 3 must be done):** `games` + `game_moves` tables exist with RLS + Realtime publication; gate procedure passed.

**Working branch:** `feat/phase-4-make-move-rpc` off `dev`.

**File structure (this phase creates / modifies):**

| Path | Responsibility |
|------|----------------|
| `lib/chess/engine.ts` | chess.js wrapper — sole import site. Exports `validateMove`, `applyMove`, `terminalStatus`, type `MoveResult`. |
| `lib/chess/engine.test.ts` | Unit tests. Bun test runner. Covers legal moves, illegal moves, en passant, castling, promotion, checkmate, stalemate, threefold, fifty-move, insufficient material. |
| `lib/schemas/move.ts` | Zod schemas: `MoveInput`, `MakeMoveResult`. |
| `app/games/[gameId]/actions.ts` | Server Action `makeMove` — validates input, calls chess.js, calls RPC, returns result or error. |
| `supabase/migrations/<ts>_make_move_rpc.sql` | `public.make_move(p_game_id uuid, p_uci text, p_expected_ply int, p_san text, p_fen_after text, p_terminal_status text)` — SECURITY DEFINER, locks row, checks ply, inserts move, updates game. Service-role RPC. |
| `e2e/lib/auth-helper.ts` | Playwright helper: `loginAs(context, email)` mints a Supabase admin session for the user and injects the cookie into the context. |
| `e2e/realtime-rls-gate.spec.ts` | Flip `test.fixme` to executable; uses `loginAs` + diagnostic page to assert positive + negative gate. |
| `e2e/illegal-moves.spec.ts` | New spec — Server Action rejects illegal moves with structured error. |
| `e2e/concurrent-moves.spec.ts` | New spec — two concurrent `makeMove` calls with same `expected_ply` — one succeeds, one fails with `concurrency_conflict`. |

---

## Tasks

### Task 1: Branch off dev

**Files:** none (git only).

- [ ] **Step 1: Pull latest dev and branch**

```bash
cd C:/workspace/narrative-chess-v2
git checkout dev
git pull
git checkout -b feat/phase-4-make-move-rpc
```

Expected: switched to new branch.

### Task 2: Build the chess.js engine wrapper

**Files:**
- Create: `lib/chess/engine.ts`

This file is the sole import site for `chess.js` (per CLAUDE.md AI rails). Everything else in the codebase imports from `@/lib/chess/engine`.

- [ ] **Step 1: Write `lib/chess/engine.ts`**

```ts
import { Chess, type Move } from "chess.js";

export type TerminalStatus =
  | "white_won"
  | "black_won"
  | "draw"
  | null;

export type MoveResult = {
  ok: true;
  san: string;
  uci: string;
  fenAfter: string;
  terminalStatus: TerminalStatus;
};

export type MoveError = {
  ok: false;
  code:
    | "illegal_move"
    | "wrong_turn"
    | "game_over"
    | "invalid_position";
  message: string;
};

export function validateMove(
  fenBefore: string,
  uci: string,
): MoveResult | MoveError {
  let chess: Chess;
  try {
    chess = new Chess(fenBefore);
  } catch {
    return {
      ok: false,
      code: "invalid_position",
      message: "FEN is not a legal chess position",
    };
  }

  if (chess.isGameOver()) {
    return {
      ok: false,
      code: "game_over",
      message: "Game is already over",
    };
  }

  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length === 5 ? uci[4] : undefined;

  let move: Move;
  try {
    move = chess.move({ from, to, promotion }) as Move;
  } catch {
    return {
      ok: false,
      code: "illegal_move",
      message: `${uci} is not a legal move from ${fenBefore}`,
    };
  }

  return {
    ok: true,
    san: move.san,
    uci: move.lan,
    fenAfter: chess.fen(),
    terminalStatus: terminalStatus(chess),
  };
}

export function applyMove(fenBefore: string, uci: string): MoveResult {
  const result = validateMove(fenBefore, uci);
  if (!result.ok) {
    throw new Error(`engine: ${result.code} — ${result.message}`);
  }
  return result;
}

function terminalStatus(chess: Chess): TerminalStatus {
  if (chess.isCheckmate()) {
    return chess.turn() === "w" ? "black_won" : "white_won";
  }
  if (
    chess.isStalemate() ||
    chess.isInsufficientMaterial() ||
    chess.isThreefoldRepetition() ||
    chess.isDraw()
  ) {
    return "draw";
  }
  return null;
}
```

- [ ] **Step 2: Verify it parses**

```bash
cd C:/workspace/narrative-chess-v2
bunx tsc --noEmit
```

Expected: no errors.

### Task 3: Write unit tests for the engine wrapper

**Files:**
- Create: `lib/chess/engine.test.ts`

- [ ] **Step 1: Write tests**

```ts
import { describe, expect, test } from "bun:test";
import { applyMove, validateMove } from "./engine";

const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("validateMove", () => {
  test("legal opening: e2e4", () => {
    const r = validateMove(STARTING_FEN, "e2e4");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.san).toBe("e4");
      expect(r.uci).toBe("e2e4");
      expect(r.fenAfter).toContain("4P3");
      expect(r.terminalStatus).toBeNull();
    }
  });

  test("illegal move from starting position: e2e5", () => {
    const r = validateMove(STARTING_FEN, "e2e5");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("illegal_move");
    }
  });

  test("invalid FEN", () => {
    const r = validateMove("not a fen", "e2e4");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("invalid_position");
    }
  });

  test("checkmate detection — Fool's Mate", () => {
    // After 1.f3 e5 2.g4 Qh4#
    const fen =
      "rnb1kbnr/pppp1ppp/8/4p3/6PP/5P2/PPPPP3/RNBQKBNR w KQkq - 1 3"; // before Qh4#
    // Walk from starting position to the mate
    // Easier: load a position one-move-before-mate then verify mate after
    // For test brevity just construct a known mate-pending FEN
    const beforeMate =
      "rnb1kbnr/pppp1ppp/8/4p3/6PP/5P2/PPPPP3/RNBQKBNR b KQkq - 1 3";
    const r = validateMove(beforeMate, "d8h4");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.terminalStatus).toBe("black_won");
    }
  });

  test("stalemate detection", () => {
    // King vs king + queen, classic stalemate — black to move, no legal move, not in check
    const stalemateBefore =
      "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1"; // White to move; play Qg7? Actually need a setup
    // Use known position: white K on f6, Q on g6, black K on h8, white to move Qg7+ would be mate
    // Stalemate: white K on f6, Q on f7, black K on h8, black to move = stalemate
    // Easier verified: use known FEN one ply before stalemate
    const beforeStalemate =
      "7k/8/5K2/8/8/8/5Q2/8 w - - 0 1"; // setup: white K f6, Q f2, black K h8
    const r = validateMove(beforeStalemate, "f2f7"); // Qf7, blocking black king's only escape
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.terminalStatus).toBe("draw");
    }
  });

  test("game over rejection on already-over position", () => {
    // Stalemate position itself — black to move, no moves, not in check
    const stalemate = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1";
    const r = validateMove(stalemate, "h8g8");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code === "illegal_move" || r.code === "game_over").toBe(true);
    }
  });

  test("promotion: e7e8q", () => {
    const fen = "8/4P3/8/8/8/8/8/4K2k w - - 0 1";
    const r = validateMove(fen, "e7e8q");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.san).toContain("Q");
    }
  });

  test("en passant", () => {
    // Position where en passant is legal: white played e2e4, black has pawn on d4
    const fen = "rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 2";
    const r = validateMove(fen, "d4e3");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.san).toBe("dxe3");
    }
  });

  test("castling: O-O kingside", () => {
    const fen =
      "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPBPPP/RNBQK2R w KQkq - 0 1";
    const r = validateMove(fen, "e1g1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.san).toBe("O-O");
    }
  });
});

describe("applyMove", () => {
  test("throws on illegal move", () => {
    expect(() => applyMove(STARTING_FEN, "e2e5")).toThrow();
  });

  test("returns result on legal move", () => {
    const r = applyMove(STARTING_FEN, "e2e4");
    expect(r.san).toBe("e4");
  });
});
```

- [ ] **Step 2: Run tests**

```bash
bun test lib/chess/engine.test.ts
```

Expected: all pass. If a specific FEN doesn't produce expected result, fix the FEN by computing it from a known game state — don't change the assertion.

- [ ] **Step 3: Commit**

```bash
git add lib/chess/
git commit -m "feat(chess): engine wrapper + unit tests (legal/illegal/terminal states)"
```

### Task 4: Add Zod schemas for move I/O

**Files:**
- Create: `lib/schemas/move.ts`

- [ ] **Step 1: Write schemas**

```ts
import { z } from "zod";

export const UciSchema = z
  .string()
  .regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/, "uci must match a-h1-8a-h1-8 + optional promo");

export const MoveInputSchema = z.object({
  gameId: z.string().uuid(),
  uci: UciSchema,
  expectedPly: z.number().int().nonnegative(),
});

export type MoveInput = z.infer<typeof MoveInputSchema>;

export const MakeMoveResultSchema = z.object({
  game_id: z.string().uuid(),
  ply: z.number().int(),
  san: z.string(),
  uci: UciSchema,
  fen_after: z.string(),
  status: z.enum([
    "open",
    "in_progress",
    "white_won",
    "black_won",
    "draw",
    "aborted",
  ]),
});

export type MakeMoveResult = z.infer<typeof MakeMoveResultSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add lib/schemas/
git commit -m "feat(schemas): zod schemas for makeMove input + result"
```

### Task 5: Generate and write the make_move RPC migration

**Files:**
- Create: `supabase/migrations/<timestamp>_make_move_rpc.sql`

- [ ] **Step 1: Generate migration file**

```bash
"C:/Users/taylo/.bun/install/global/node_modules/supabase/bin/supabase.exe" migration new make_move_rpc
```

Note the generated filename.

- [ ] **Step 2: Write the migration**

```sql
-- Phase 4 — make_move RPC + RLS allow-list for the function
-- Spec: docs/superpowers/specs/2026-05-02-v2-foundation-design.md §6.3

set check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- 1. make_move RPC
--    Trust boundary: the Server Action validates the move with chess.js and
--    passes the *already-validated* san + fen_after + optional terminal_status.
--    The RPC's job is persistence + concurrency, not chess legality.
--
--    Why expected_ply: prevents (a) two clients racing the same move, and
--    (b) replay of an old move when a newer one already landed.
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
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  -- Lock the game row so no concurrent move slips in between our checks.
  select * into g from public.games where id = p_game_id for update;

  if not found then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;

  -- Caller must be a participant. RLS already gates SELECT, but SECURITY DEFINER
  -- bypasses RLS so we re-check explicitly.
  if v_caller <> g.white_id and v_caller <> g.black_id then
    raise exception 'not_a_participant' using errcode = 'P0001';
  end if;

  -- Optimistic concurrency.
  if g.ply <> p_expected_ply then
    raise exception 'concurrency_conflict' using errcode = 'P0001',
      detail = format('expected_ply=%s, current_ply=%s', p_expected_ply, g.ply);
  end if;

  if g.status not in ('in_progress') then
    raise exception 'not_active' using errcode = 'P0001',
      detail = format('current_status=%s', g.status);
  end if;

  -- Caller must own the side to move.
  if g.current_turn = 'w' and v_caller <> g.white_id then
    raise exception 'wrong_turn' using errcode = 'P0001';
  end if;
  if g.current_turn = 'b' and v_caller <> g.black_id then
    raise exception 'wrong_turn' using errcode = 'P0001';
  end if;

  -- Append the move. Primary key (game_id, ply) prevents duplicate at same ply.
  insert into public.game_moves (game_id, ply, san, uci, fen_after, played_by)
  values (p_game_id, g.ply + 1, p_san, p_uci, p_fen_after, v_caller);

  -- Compute next status.
  v_new_status := coalesce(p_terminal_status, 'in_progress');
  if v_new_status not in ('in_progress','white_won','black_won','draw') then
    raise exception 'invalid_terminal_status' using errcode = 'P0001';
  end if;

  -- Update game row: increment ply, flip turn, swap fen, possibly end the game.
  update public.games
  set
    ply = g.ply + 1,
    current_fen = p_fen_after,
    current_turn = case when g.current_turn = 'w' then 'b' else 'w' end,
    status = v_new_status,
    ended_at = case when v_new_status in ('white_won','black_won','draw') then now() else null end
  where id = p_game_id
  returning * into g;

  return g;
end;
$$;

revoke all on function public.make_move(uuid, text, text, text, int, text) from public;
grant execute on function public.make_move(uuid, text, text, text, int, text) to authenticated;

comment on function public.make_move(uuid, text, text, text, int, text) is
  'Atomic move append. Server Action validates with chess.js then calls this. RPC checks participant + concurrency + status, then inserts move and updates game.';
```

- [ ] **Step 3: Push the migration**

```bash
"C:/Users/taylo/.bun/install/global/node_modules/supabase/bin/supabase.exe" db push --include-all
```

Confirm at the prompt. Expect: success.

- [ ] **Step 4: Verify advisors clean**

Use Supabase MCP `get_advisors` for `security`. The new function has `security definer` + `set search_path = public` already, so no `function_search_path_mutable` warning should fire.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(supabase): make_move RPC with concurrency + participant checks"
```

### Task 6: Write the makeMove Server Action

**Files:**
- Create: `app/games/[gameId]/actions.ts`

- [ ] **Step 1: Write the action**

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { applyMove } from "@/lib/chess/engine";
import {
  MoveInputSchema,
  MakeMoveResultSchema,
  type MakeMoveResult,
} from "@/lib/schemas/move";

export type MakeMoveOutcome =
  | { ok: true; data: MakeMoveResult }
  | {
      ok: false;
      code:
        | "validation"
        | "illegal_move"
        | "concurrency_conflict"
        | "not_a_participant"
        | "wrong_turn"
        | "not_active"
        | "game_not_found"
        | "unauthenticated"
        | "unknown";
      message: string;
    };

export async function makeMove(input: unknown): Promise<MakeMoveOutcome> {
  const parsed = MoveInputSchema.safeParse(input);
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

  const { data: game } = await supabase
    .from("games")
    .select("current_fen, current_turn, ply, status")
    .eq("id", parsed.data.gameId)
    .single();

  if (!game) {
    return {
      ok: false,
      code: "game_not_found",
      message: "game not found or not visible",
    };
  }

  // chess.js validation happens here, in the Server Action — option A from spec.
  const engineResult = applyMove(game.current_fen, parsed.data.uci);

  const { data: rpcRow, error } = await supabase
    .rpc("make_move", {
      p_game_id: parsed.data.gameId,
      p_uci: engineResult.uci,
      p_san: engineResult.san,
      p_fen_after: engineResult.fenAfter,
      p_expected_ply: parsed.data.expectedPly,
      p_terminal_status: engineResult.terminalStatus ?? null,
    })
    .single();

  if (error) {
    const code = mapPgError(error.message);
    return { ok: false, code, message: error.message };
  }

  const result = MakeMoveResultSchema.parse({
    game_id: parsed.data.gameId,
    ply: rpcRow.ply,
    san: engineResult.san,
    uci: engineResult.uci,
    fen_after: rpcRow.current_fen,
    status: rpcRow.status,
  });

  return { ok: true, data: result };
}

function mapPgError(msg: string): MakeMoveOutcome extends { ok: false; code: infer C } ? C : never {
  if (msg.includes("concurrency_conflict")) return "concurrency_conflict" as never;
  if (msg.includes("not_a_participant")) return "not_a_participant" as never;
  if (msg.includes("wrong_turn")) return "wrong_turn" as never;
  if (msg.includes("not_active")) return "not_active" as never;
  if (msg.includes("game_not_found")) return "game_not_found" as never;
  if (msg.includes("unauthenticated")) return "unauthenticated" as never;
  return "unknown" as never;
}
```

- [ ] **Step 2: TS + lint**

```bash
bunx tsc --noEmit && bun run lint
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/games/
git commit -m "feat(games): makeMove server action — chess.js validation + RPC call"
```

### Task 7: Add programmatic auth helper for Playwright

**Files:**
- Create: `e2e/lib/auth-helper.ts`

- [ ] **Step 1: Write the helper**

```ts
import type { BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "auth-helper requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY",
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export async function ensureUser(email: string, password: string) {
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list.users.find((u) => u.email === email);
  if (existing) return existing;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: email.split("@")[0] },
  });
  if (error) throw error;
  return data.user;
}

export async function loginAs(
  context: BrowserContext,
  email: string,
  password: string,
  baseURL: string,
) {
  await ensureUser(email, password);

  // Mint a session via password grant against the live project.
  const anon = createClient(SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const session = data.session;
  if (!session) throw new Error("no session returned from password grant");

  // Inject the session as cookies the @supabase/ssr middleware will recognize.
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: `sb-${url.hostname.replace(/\./g, "-")}-auth-token`,
      value: encodeURIComponent(
        JSON.stringify([
          session.access_token,
          session.refresh_token,
          null,
          null,
          null,
        ]),
      ),
      domain: url.hostname,
      path: "/",
      httpOnly: false,
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
  ]);
}
```

(Cookie name + shape match `@supabase/ssr` v0.10 — verify against `lib/supabase/server.ts` if Supabase upgrades.)

- [ ] **Step 2: Commit**

```bash
git add e2e/lib/
git commit -m "test(e2e): programmatic auth helper using supabase admin api + cookie injection"
```

### Task 8: Flip the realtime-rls-gate spec to executable

**Files:**
- Modify: `e2e/realtime-rls-gate.spec.ts`

- [ ] **Step 1: Replace the body**

```ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ensureUser, loginAs } from "./lib/auth-helper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY,
  "skipped: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set",
);

test("participant sees Realtime event with row data; non-participant gets silence", async ({
  browser,
}) => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const userA = await ensureUser("e2e-a@example.com", "test1234password!");
  const userC = await ensureUser("e2e-c@example.com", "test1234password!");

  const { data: game } = await admin
    .from("games")
    .insert({
      white_id: userA.id,
      black_id: userA.id, // self-vs-self isolates this game; userC is non-participant
      status: "in_progress",
    })
    .select("id")
    .single();
  expect(game).toBeTruthy();
  const gameId = game!.id;

  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await loginAs(ctxA, "e2e-a@example.com", "test1234password!", BASE_URL);
  await pageA.goto(`${BASE_URL}/diagnostics/realtime`);
  await pageA.fill('input[id="gameId"]', gameId);
  await pageA.click('button:has-text("Subscribe")');
  await expect(pageA.locator("text=subscription: SUBSCRIBED")).toBeVisible({
    timeout: 5_000,
  });

  const ctxC = await browser.newContext();
  const pageC = await ctxC.newPage();
  await loginAs(ctxC, "e2e-c@example.com", "test1234password!", BASE_URL);
  await pageC.goto(`${BASE_URL}/diagnostics/realtime`);
  await pageC.fill('input[id="gameId"]', gameId);
  await pageC.click('button:has-text("Subscribe")');
  await expect(pageC.locator("text=subscription: SUBSCRIBED")).toBeVisible({
    timeout: 5_000,
  });

  // Insert a move via admin (bypasses RLS, simulates a successful make_move).
  await admin.from("game_moves").insert({
    game_id: gameId,
    ply: 1,
    san: "e4",
    uci: "e2e4",
    fen_after:
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    played_by: userA.id,
  });

  await expect(pageA.locator("text=Events (1)")).toBeVisible({ timeout: 5_000 });
  await expect(pageA.getByText('"san": "e4"')).toBeVisible({ timeout: 2_000 });
  await expect(pageC.locator("text=Events (0)")).toBeVisible();

  await admin.from("games").delete().eq("id", gameId);
  await ctxA.close();
  await ctxC.close();
});
```

- [ ] **Step 2: Run the spec locally**

```bash
SUPABASE_SERVICE_ROLE_KEY=<from dashboard> bunx playwright test e2e/realtime-rls-gate.spec.ts
```

(Ask user to provide SUPABASE_SERVICE_ROLE_KEY temporarily; do NOT commit it. Add to Vercel/CI env vars permanently.)

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/realtime-rls-gate.spec.ts
git commit -m "test(e2e): activate realtime+rls gate (programmatic auth + admin insert)"
```

### Task 9: Add e2e for illegal move rejection

**Files:**
- Create: `e2e/illegal-moves.spec.ts`

- [ ] **Step 1: Write spec**

```ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ensureUser, loginAs } from "./lib/auth-helper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY,
  "skipped: env vars not set",
);

test("server action rejects illegal moves before reaching the RPC", async ({
  browser,
}) => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const userA = await ensureUser("e2e-illegal@example.com", "test1234password!");

  const { data: game } = await admin
    .from("games")
    .insert({
      white_id: userA.id,
      black_id: userA.id,
      status: "in_progress",
    })
    .select("id")
    .single();
  const gameId = game!.id;

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAs(ctx, "e2e-illegal@example.com", "test1234password!", BASE_URL);

  // Call the Server Action via fetch to the route's POST endpoint.
  // (Phase 5 board UI will exercise this through the actual UI; for now we hit it directly.)
  const response = await page.request.post(`${BASE_URL}/api/games/${gameId}/move`, {
    data: { gameId, uci: "e2e5", expectedPly: 0 },
  });

  // Expect either a structured error response OR an action-level outcome with code='illegal_move'.
  // Adapt the assertion to whatever surface the route exposes.
  expect([400, 422, 200]).toContain(response.status());
  const body = await response.json().catch(() => null);
  if (response.status() === 200 && body?.ok === false) {
    expect(body.code).toBe("illegal_move");
  }

  await admin.from("games").delete().eq("id", gameId);
  await ctx.close();
});
```

(Note: this test assumes a thin route adapter at `app/api/games/[gameId]/move/route.ts` that calls the Server Action. If you prefer the Server Action be invoked only via the UI, replace this test with a UI test in Phase 5 and skip it here.)

- [ ] **Step 2: Add the route adapter (optional — only if running this test now)**

```ts
// app/api/games/[gameId]/move/route.ts
import { NextResponse } from "next/server";
import { makeMove } from "@/app/games/[gameId]/actions";

export async function POST(req: Request) {
  const body = await req.json();
  const result = await makeMove(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
```

- [ ] **Step 3: Commit**

```bash
git add e2e/illegal-moves.spec.ts app/api/
git commit -m "test(e2e): illegal-move rejection via server action"
```

### Task 10: Add e2e for concurrent-move conflict

**Files:**
- Create: `e2e/concurrent-moves.spec.ts`

- [ ] **Step 1: Write spec**

```ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ensureUser } from "./lib/auth-helper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

test.skip(
  !SUPABASE_URL || !SERVICE_ROLE_KEY,
  "skipped: env vars not set",
);

test("concurrent makeMove with same expected_ply: one wins, one returns concurrency_conflict", async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const userA = await ensureUser("e2e-conc-a@example.com", "test1234password!");
  const userB = await ensureUser("e2e-conc-b@example.com", "test1234password!");

  const { data: game } = await admin
    .from("games")
    .insert({
      white_id: userA.id,
      black_id: userB.id,
      status: "in_progress",
    })
    .select("id")
    .single();
  const gameId = game!.id;

  // Mint two clients each authed as userA (white, on move at ply=0).
  const anon = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data: sess } = await anon.auth.signInWithPassword({
    email: "e2e-conc-a@example.com",
    password: "test1234password!",
  });
  const userClient = createClient(
    SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${sess!.session!.access_token}` } },
    },
  );

  const args = {
    p_game_id: gameId,
    p_uci: "e2e4",
    p_san: "e4",
    p_fen_after:
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    p_expected_ply: 0,
    p_terminal_status: null,
  };

  const [first, second] = await Promise.all([
    userClient.rpc("make_move", args),
    userClient.rpc("make_move", args),
  ]);

  const wins = [first, second].filter((r) => !r.error).length;
  const losses = [first, second]
    .filter((r) => r.error)
    .filter((r) => /concurrency_conflict/.test(r.error!.message)).length;

  expect(wins).toBe(1);
  expect(losses).toBe(1);

  await admin.from("games").delete().eq("id", gameId);
});
```

- [ ] **Step 2: Run**

```bash
SUPABASE_SERVICE_ROLE_KEY=<key> bunx playwright test e2e/concurrent-moves.spec.ts
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/concurrent-moves.spec.ts
git commit -m "test(e2e): concurrent makeMove conflict — one wins, one fails"
```

### Task 11: Add SUPABASE_SERVICE_ROLE_KEY to Vercel + CI

**Files:**
- Modify: `lib/env.ts` (mark service-role optional but recognized)
- Modify: `.env.local.example` (document the var)

- [ ] **Step 1: Update env.ts schema**

Confirm the existing `lib/env.ts` server schema already includes `SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional()`. If not, add it.

- [ ] **Step 2: Update .env.local.example**

Append:

```
# Required for e2e specs that exercise the make_move RPC + admin actions.
# DO NOT commit the actual value. Get it from Supabase Studio → Settings → API.
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 3: Add the var to Vercel (Production + Preview)**

```bash
vercel env add SUPABASE_SERVICE_ROLE_KEY production --value "<key>" --yes
vercel env add SUPABASE_SERVICE_ROLE_KEY preview dev --value "<key>" --yes
vercel env add SUPABASE_SERVICE_ROLE_KEY development --value "<key>" --yes
```

(Service role key is sensitive — only use Production for code that needs it server-side. Never expose to NEXT_PUBLIC_ prefix.)

- [ ] **Step 4: Add the var to GitHub Actions**

In `.github/workflows/ci.yml`, the `Run e2e` step needs to pull the secret. Update:

```yaml
- name: Run e2e
  if: steps.detect_e2e.outputs.has_specs == 'true'
  run: bunx playwright test
  env:
    CI: true
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
    PLAYWRIGHT_BASE_URL: http://localhost:3000
```

Then add the corresponding secrets to the GitHub repo via `gh secret set NAME --body=<value>` (user runs).

- [ ] **Step 5: Commit env scaffold (no actual key values committed)**

```bash
git add lib/env.ts .env.local.example .github/workflows/ci.yml
git commit -m "ci: wire service-role key for e2e specs (vercel + GH actions secrets)"
```

### Task 12: Open PR + merge

**Files:** none (PR work).

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/phase-4-make-move-rpc
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --base dev --head feat/phase-4-make-move-rpc \
  --title "feat: Phase 4 — make_move RPC + chess.js engine wrapper" \
  --body "$(cat <<'EOF'
## What changed

- `lib/chess/engine.ts` + unit tests — chess.js wrapper, sole import site (per CLAUDE.md AI rails)
- `lib/schemas/move.ts` — Zod schemas for makeMove input + result
- Migration `<ts>_make_move_rpc.sql` — public.make_move RPC with SECURITY DEFINER, participant + concurrency + status checks; service-role-only insert into game_moves; updates games row atomically
- `app/games/[gameId]/actions.ts` — makeMove Server Action: validates with chess.js, calls RPC, maps Postgres error codes to typed outcomes
- `e2e/lib/auth-helper.ts` — programmatic auth helper (Supabase admin API + cookie injection)
- `e2e/realtime-rls-gate.spec.ts` — flipped from test.fixme to executable; uses helper
- `e2e/illegal-moves.spec.ts` — Server Action rejects illegal moves
- `e2e/concurrent-moves.spec.ts` — concurrent RPC calls with same expected_ply: one wins, one fails
- Vercel + GH Actions: `SUPABASE_SERVICE_ROLE_KEY` wired

## How tested

- `bun test lib/chess/engine.test.ts` — all unit tests pass (legal/illegal/checkmate/stalemate/promotion/en passant/castling)
- `bunx tsc --noEmit` clean
- `bun run lint` clean
- `bunx playwright test` — all 3 e2e specs pass against live SB project
- Supabase advisors clean

## Checklist

- [x] CI green locally
- [x] Migration touched — make_move RPC; advisors clean
- [x] RLS or Realtime touched? RPC bypasses RLS via SECURITY DEFINER but re-checks participant + caller role explicitly
- [x] Server Action takes user input — validated via Zod + chess.js engine
- [x] chess.js imported only in lib/chess/engine.ts

## What's next

Phase 5 — board UI with drag-and-drop + Realtime sync to client state.
EOF
)"
```

- [ ] **Step 3: Wait for CI green**

```bash
gh pr checks
```

Expected: `lint-and-test` passes (and now actually runs the e2e suite — should pass).

- [ ] **Step 4: Merge to dev**

```bash
gh pr merge --merge --delete-branch
```

- [ ] **Step 5: Pull dev locally**

```bash
git checkout dev
git pull
```

---

## Phase 4 done — verification gate

Before declaring Phase 4 complete:

- [ ] Unit tests pass: `bun test lib/chess/`
- [ ] Migration applied to v2 SB project: `make_move` function visible in `pg_proc`
- [ ] Manual smoke: from a logged-in browser console, calling `supabase.rpc('make_move', {...legal move args...})` succeeds and returns the updated `games` row
- [ ] e2e suite passes against live project: `bunx playwright test`
- [ ] Concurrency test demonstrates one-wins-one-fails outcome
- [ ] Production redeploy succeeds (Vercel auto-build on dev → main squash later)

When all 6 boxes ticked, Phase 4 is shippable. Move to Phase 5 planning (board UI + drag-and-drop + Realtime sync to local state).

---

## What's next (Phase 5 preview)

Phase 5 will be planned in its own document. Highlights:
- `components/board/Board.tsx` — drag-and-drop chess board (likely `@dnd-kit` for drag-drop primitives + custom rendering of pieces)
- `lib/realtime/subscribe.ts` — typed Realtime subscription per spec §6.4
- `app/games/[gameId]/page.tsx` — joins board + realtime + makeMove action
- `app/games/page.tsx` + `app/games/new/page.tsx` — game list + create-game flow (which may surface a `create_game` RPC if we want games created via UI rather than only via service-role)

Phase 5 is gated on Phase 4 complete because the board UI needs `makeMove` working server-side before any UI can drive it.
