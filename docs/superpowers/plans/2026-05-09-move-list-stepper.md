# Move List Stepper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a review-only move history panel below the player pills on the game page. Click + keyboard scrub through past plies, auto-snap back to live on opponent move, audio cue + Your-turn toast on every move arrival.

**Architecture:** RSC parallel fetch of `game_moves` in `page.tsx` passes `initialMoves` to GameClient. GameClient owns `moves` state + `viewedPly` state (null = follow live). Existing `subscribeToMoves` realtime callback augmented to accumulate moves. Display FEN derived from `viewedPly`. New `MoveList` + `MoveCell` components render the grid; GSAP animates entry + arrivals; sonner toasts the Your-turn cue.

**Tech Stack:** Next.js 16.2, React 19, TypeScript, Tailwind v4, react-chessboard, gsap + @gsap/react, sonner (existing toast lib), vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-09-move-list-stepper-design.md`

**Branch:** `feat/move-list-stepper` off `dev`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `lib/chess/move-list.ts` | create | Pure helpers: `pairsFromMoves`, `viewedFen`, `stepPly`. Tested by vitest. |
| `lib/chess/move-list.test.ts` | create | Unit tests for the helpers above. |
| `app/games/[gameId]/MoveCell.tsx` | create | Single move button with active/inactive variants. |
| `app/games/[gameId]/MoveList.tsx` | create | Grid container, empty state, keyboard listener, GSAP animations, auto-scroll. |
| `app/games/[gameId]/page.tsx` | modify | Parallel fetch `game_moves`. Pass `initialMoves` prop. |
| `app/games/[gameId]/GameClient.tsx` | modify | Add `moves` + `viewedPly` state, `displayFen` memo, drag-lock, auto-snap effect, audio + toast on livePly bump, render `<MoveList>`. |
| `public/sounds/move.mp3` | create | Wooden-thunk audio asset (lichess `Standard/Move.mp3`, CC-BY). |
| `public/sounds/README.md` | create | Asset license + attribution. |
| `e2e/move-list-stepper.spec.ts` | create | Two-browser smoke + scrub + auto-snap + toast assertions. |

---

## Task 1: Pure helpers + unit tests

**Files:**
- Create: `lib/chess/move-list.ts`
- Create: `lib/chess/move-list.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/chess/move-list.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pairsFromMoves, viewedFen, stepPly } from "./move-list";

const MOVES = [
  { ply: 1, san: "e4", fen_after: "FEN1" },
  { ply: 2, san: "c5", fen_after: "FEN2" },
  { ply: 3, san: "Nf3", fen_after: "FEN3" },
];

describe("pairsFromMoves", () => {
  it("returns empty array when moves is empty", () => {
    expect(pairsFromMoves([])).toEqual([]);
  });

  it("pairs white + black per move number", () => {
    expect(pairsFromMoves(MOVES.slice(0, 2))).toEqual([
      { moveNum: 1, white: MOVES[0], black: MOVES[1] },
    ]);
  });

  it("trailing white move has null black", () => {
    expect(pairsFromMoves(MOVES)).toEqual([
      { moveNum: 1, white: MOVES[0], black: MOVES[1] },
      { moveNum: 2, white: MOVES[2], black: null },
    ]);
  });
});

describe("viewedFen", () => {
  const liveFen = "LIVE_FEN";

  it("returns liveFen when viewedPly is null", () => {
    expect(viewedFen(MOVES, null, liveFen)).toBe(liveFen);
  });

  it("returns liveFen when viewedPly equals last move ply", () => {
    expect(viewedFen(MOVES, 3, liveFen)).toBe(liveFen);
  });

  it("returns fen_after of the matching move", () => {
    expect(viewedFen(MOVES, 1, liveFen)).toBe("FEN1");
    expect(viewedFen(MOVES, 2, liveFen)).toBe("FEN2");
  });

  it("returns the chess starting FEN when viewedPly is 0", () => {
    expect(viewedFen(MOVES, 0, liveFen)).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
  });

  it("falls back to liveFen when viewedPly has no matching move", () => {
    expect(viewedFen(MOVES, 99, liveFen)).toBe(liveFen);
  });
});

describe("stepPly", () => {
  it("steps forward within range", () => {
    expect(stepPly(2, +1, 5)).toBe(3);
  });

  it("steps back within range", () => {
    expect(stepPly(2, -1, 5)).toBe(1);
  });

  it("clamps at 0 going back", () => {
    expect(stepPly(0, -1, 5)).toBe(0);
  });

  it("clamps at livePly going forward", () => {
    expect(stepPly(5, +1, 5)).toBe(5);
  });

  it("treats null current as livePly anchor", () => {
    expect(stepPly(null, -1, 5)).toBe(4);
    expect(stepPly(null, +1, 5)).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bunx vitest run lib/chess/move-list.test.ts
```

Expected: All tests fail with "Cannot find module './move-list'" or similar.

- [ ] **Step 3: Implement `lib/chess/move-list.ts`**

```ts
import type { MoveEvent } from "@/lib/schemas/game";

const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type MoveLike = Pick<MoveEvent, "ply" | "san" | "fen_after">;

export type Pair = {
  moveNum: number;
  white: MoveLike;
  black: MoveLike | null;
};

/**
 * Group sequential moves into white/black pairs by full-move number.
 * `moveNum` is 1-indexed (chess convention). Trailing white move with no
 * black response yields a pair with black=null.
 */
export function pairsFromMoves(moves: MoveLike[]): Pair[] {
  const sorted = [...moves].sort((a, b) => a.ply - b.ply);
  const pairs: Pair[] = [];
  for (let i = 0; i < sorted.length; i += 2) {
    pairs.push({
      moveNum: Math.floor(i / 2) + 1,
      white: sorted[i],
      black: sorted[i + 1] ?? null,
    });
  }
  return pairs;
}

/**
 * Resolve the FEN to display on the board given the user's scrub position.
 * - viewedPly === null         -> liveFen (follow live)
 * - viewedPly === 0            -> standard chess starting position
 * - viewedPly === last move    -> liveFen (no need to look up)
 * - otherwise                  -> fen_after of matching move, fall back to liveFen
 */
export function viewedFen(
  moves: MoveLike[],
  viewedPly: number | null,
  liveFen: string,
): string {
  if (viewedPly === null) return liveFen;
  if (viewedPly === 0) return STARTING_FEN;
  const lastPly = moves.length > 0 ? moves[moves.length - 1].ply : 0;
  if (viewedPly === lastPly) return liveFen;
  const m = moves.find((mv) => mv.ply === viewedPly);
  return m?.fen_after ?? liveFen;
}

/**
 * Step the viewed ply by delta (typically -1 / +1), clamped to [0, livePly].
 * Treats `null` as "currently at livePly" so left-arrow from live snaps to
 * livePly - 1.
 */
export function stepPly(
  current: number | null,
  delta: number,
  livePly: number,
): number {
  const anchor = current ?? livePly;
  const next = anchor + delta;
  return Math.max(0, Math.min(livePly, next));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bunx vitest run lib/chess/move-list.test.ts
```

Expected: All 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git checkout -b feat/move-list-stepper
git add lib/chess/move-list.ts lib/chess/move-list.test.ts
git commit -m "feat(chess): pure helpers for move-list pairing + FEN derivation

pairsFromMoves groups sequential moves into white/black pairs.
viewedFen resolves the display FEN given a scrub position. stepPly
clamps a delta-step to [0, livePly]. All three are pure + unit-tested
via vitest. Polish B foundation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: MoveCell + MoveList components (presentational)

**Files:**
- Create: `app/games/[gameId]/MoveCell.tsx`
- Create: `app/games/[gameId]/MoveList.tsx`

- [ ] **Step 1: Write `MoveCell.tsx`**

```tsx
"use client";

import { cn } from "@/lib/utils";

type Props = {
  ply: number;
  san: string;
  isActive: boolean;
  isRecent: boolean; // last 8 plies, for entry stagger animation
  onSelect: (ply: number) => void;
};

export function MoveCell({ ply, san, isActive, isRecent, onSelect }: Props) {
  return (
    <button
      type="button"
      data-ply={ply}
      data-recent={isRecent ? "" : undefined}
      onClick={() => onSelect(ply)}
      className={cn(
        "move-cell text-left px-2 py-1 font-mono text-[13px] tabular-nums transition-colors rounded-sm",
        isActive
          ? "bg-oxblood text-cream"
          : "text-foreground hover:bg-bg-soft",
      )}
    >
      {san}
    </button>
  );
}
```

- [ ] **Step 2: Write `MoveList.tsx` (initial scaffold, no animations or keyboard yet)**

```tsx
"use client";

import { useMemo } from "react";
import { pairsFromMoves, type MoveLike } from "@/lib/chess/move-list";
import { MoveCell } from "./MoveCell";

type Props = {
  moves: MoveLike[];
  livePly: number;
  viewedPly: number | null;
  onScrub: (ply: number | null) => void;
};

export function MoveList({ moves, livePly, viewedPly, onScrub }: Props) {
  const pairs = useMemo(() => pairsFromMoves(moves), [moves]);
  const activePly = viewedPly ?? livePly;
  const recentThreshold = Math.max(1, livePly - 7); // last 8 plies

  if (moves.length === 0) {
    return (
      <div className="w-full max-w-xl mx-auto px-1 py-3">
        <p className="font-body italic text-ink-soft text-sm">No moves yet.</p>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-xl mx-auto px-1 py-2 max-h-72 overflow-y-auto"
      data-testid="move-list"
    >
      <div className="grid grid-cols-[40px_1fr_1fr] gap-x-2 gap-y-1">
        {pairs.map((pair) => (
          <div className="contents move-row" data-move-num={pair.moveNum} key={pair.moveNum}>
            <span className="font-mono text-[11px] text-ink-faint self-center text-right pr-1">
              {pair.moveNum}.
            </span>
            <MoveCell
              ply={pair.white.ply}
              san={pair.white.san}
              isActive={pair.white.ply === activePly}
              isRecent={pair.white.ply >= recentThreshold}
              onSelect={onScrub}
            />
            {pair.black ? (
              <MoveCell
                ply={pair.black.ply}
                san={pair.black.san}
                isActive={pair.black.ply === activePly}
                isRecent={pair.black.ply >= recentThreshold}
                onSelect={onScrub}
              />
            ) : (
              <span aria-hidden />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
bunx tsc --noEmit
```

Expected: pass.

- [ ] **Step 4: Verify lint**

```bash
bun run lint
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add app/games/[gameId]/MoveCell.tsx app/games/[gameId]/MoveList.tsx
git commit -m "feat(game): MoveList + MoveCell components (presentational)

Two-column grid of move pairs. Active ply gets oxblood + cream
highlight. Each cell is a button (clickable + e2e-targetable via
data-ply). Empty state when ply === 0. Last 8 cells marked with
data-recent for upcoming GSAP stagger.

No state, no realtime, no animations yet - that's wired in
subsequent tasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Wire RSC fetch in page.tsx

**Files:**
- Modify: `app/games/[gameId]/page.tsx`

- [ ] **Step 1: Read current page.tsx structure**

```bash
cat app/games/[gameId]/page.tsx
```

Note: existing code fetches the `games` row. We're adding a parallel `game_moves` fetch and a new prop pass-through to `<GameClient>`.

- [ ] **Step 2: Modify `page.tsx`**

Find the existing supabase query for the game row. Replace the single `await` with `Promise.all`:

```tsx
const supabase = await createClient();

const [gameRes, movesRes] = await Promise.all([
  supabase
    .from("games")
    .select("...existing select...")
    .eq("id", gameId)
    .maybeSingle(),
  supabase
    .from("game_moves")
    .select("game_id, ply, san, uci, fen_after, played_by, played_at")
    .eq("game_id", gameId)
    .order("ply", { ascending: true }),
]);

const game = gameRes.data;
const initialMoves = movesRes.data ?? [];
```

Then pass `initialMoves` to `<GameClient>`:

```tsx
<GameClient
  // ...existing props...
  initialMoves={initialMoves}
/>
```

(Implementer: copy the exact existing select string from the current `games` query; only change the await structure + add the second query + the new prop. Do not modify the games-row select fields.)

- [ ] **Step 3: Update GameClient props type**

In `app/games/[gameId]/GameClient.tsx`, find the `Props` type definition and add:

```ts
import type { MoveEvent } from "@/lib/schemas/game";

type Props = {
  // ...existing fields...
  initialMoves: MoveEvent[];
};
```

Destructure `initialMoves` in the function signature alongside other props.

- [ ] **Step 4: Verify**

```bash
bunx tsc --noEmit && bun run lint
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add app/games/[gameId]/page.tsx app/games/[gameId]/GameClient.tsx
git commit -m "feat(game): RSC parallel fetch of game_moves + initialMoves prop

page.tsx now runs the games + game_moves queries in parallel via
Promise.all, passes initialMoves array to GameClient. RLS on
game_moves already permits SELECT for game participants and observers
(per migration 20260502185717_init_games.sql), no policy changes
needed.

GameClient accepts initialMoves but does not use it yet - that
wiring lands in the next task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: viewedPly state + displayFen + drag-lock + auto-snap in GameClient

**Files:**
- Modify: `app/games/[gameId]/GameClient.tsx`

- [ ] **Step 1: Add moves state, viewedPly state, displayFen memo**

Inside `GameClient` component, near the existing `useState` calls (where `state` is initialized via `useReducer` or similar), add:

```ts
import { viewedFen, stepPly, type MoveLike } from "@/lib/chess/move-list";

// After existing state:
const [moves, setMoves] = useState<MoveLike[]>(
  initialMoves.map((m) => ({ ply: m.ply, san: m.san, fen_after: m.fen_after })),
);
const [viewedPly, setViewedPly] = useState<number | null>(null);

const livePly = state.ply;

const displayFen = useMemo(() => {
  return viewedFen(moves, viewedPly, state.fen);
}, [moves, viewedPly, state.fen]);
```

- [ ] **Step 2: Auto-snap effect**

Add an effect that resets `viewedPly` to null whenever `livePly` increments:

```ts
const prevLivePlyRef = useRef(livePly);
useEffect(() => {
  if (livePly !== prevLivePlyRef.current) {
    setViewedPly(null);
    prevLivePlyRef.current = livePly;
  }
}, [livePly]);
```

- [ ] **Step 3: Drag-lock when scrubbed back**

Find the `<Chessboard>` component invocation. Currently it likely passes `position={state.fen}` and an `arePiecesDraggable` prop (or similar). Replace:

```tsx
<Chessboard
  position={displayFen}
  arePiecesDraggable={
    /* existing logic */ &&
    (viewedPly === null || viewedPly === livePly)
  }
  /* ...other props... */
/>
```

(Implementer: preserve all other Chessboard props verbatim; only swap `state.fen` for `displayFen` and AND the existing `arePiecesDraggable` expression with the new clause.)

- [ ] **Step 4: Augment subscribeToMoves callback to accumulate moves**

Find the existing `void subscribeToMoves(gameId, (m) => { applyMoveLocal(...) })` call (around line 262). Add a `setMoves` call inside the same callback:

```ts
void subscribeToMoves(gameId, (m) => {
  // ...existing applyMoveLocal call...
  setMoves((prev) => {
    if (prev.some((x) => x.ply === m.ply)) return prev;
    return [...prev, { ply: m.ply, san: m.san, fen_after: m.fen_after }].sort(
      (a, b) => a.ply - b.ply,
    );
  });
});
```

Also append moves on the user's own optimistic move. Find where `applyMoveLocal({ ply: result.data.ply, fen: ... })` is called after a successful Server Action, and add a `setMoves` next to it:

```ts
applyMoveLocal({ ply: result.data.ply, fen: result.data.fen_after });
setMoves((prev) => {
  if (prev.some((x) => x.ply === result.data.ply)) return prev;
  return [...prev, {
    ply: result.data.ply,
    san: result.data.san,
    fen_after: result.data.fen_after,
  }].sort((a, b) => a.ply - b.ply);
});
```

- [ ] **Step 5: Render `<MoveList />` below the player-pills row**

Find the JSX where `renderPlayerPill("w")` and `renderPlayerPill("b")` are rendered. Below their container `<div>`, add:

```tsx
import { MoveList } from "./MoveList";

// In JSX, below the player pills row:
<MoveList
  moves={moves}
  livePly={livePly}
  viewedPly={viewedPly}
  onScrub={setViewedPly}
/>
```

- [ ] **Step 6: Verify**

```bash
bunx tsc --noEmit && bun run lint
```

Expected: pass.

- [ ] **Step 7: Manual smoke check**

```bash
bun run dev
```

Open `/games/<some-existing-game-id>`. Verify:
- Move list panel renders below the player pills with all past moves
- Click a past ply -> board scrubs to that position; clicked cell highlighted oxblood
- Click latest ply -> board returns to live (or use down-arrow once keyboard lands in next task)

- [ ] **Step 8: Commit**

```bash
git add app/games/[gameId]/GameClient.tsx
git commit -m "feat(game): wire viewedPly + displayFen + drag-lock + auto-snap

GameClient now owns moves[] (seeded from initialMoves prop) and
viewedPly state. displayFen memo derives from moves + viewedPly via
viewedFen helper. Chessboard reads displayFen and disables drag when
scrubbed back. Auto-snap effect resets viewedPly to null whenever
livePly bumps, so opponent moves jump the viewer back to live.

Subscriber callback also accumulates moves[] alongside existing
applyMoveLocal call. Optimistic-move handler appends to moves[]
synchronously so own moves appear in the list before the realtime
INSERT round-trips.

MoveList rendered below the player pills, full-width up to max-w-xl
to match the board column.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Keyboard navigation

**Files:**
- Modify: `app/games/[gameId]/MoveList.tsx`

- [ ] **Step 1: Add keyboard listener inside MoveList**

At the top of the `MoveList` component body (before the `pairs` useMemo), add:

```tsx
import { useEffect } from "react";
import { stepPly } from "@/lib/chess/move-list";

// Inside MoveList component:
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t?.matches?.("input, textarea, [contenteditable]")) return;

    if (e.key === "ArrowLeft") {
      const next = stepPly(viewedPly, -1, livePly);
      onScrub(next === livePly ? null : next);
    } else if (e.key === "ArrowRight") {
      const next = stepPly(viewedPly, +1, livePly);
      onScrub(next === livePly ? null : next);
    } else if (e.key === "ArrowUp") {
      onScrub(0);
    } else if (e.key === "ArrowDown") {
      onScrub(null);
    } else {
      return;
    }
    e.preventDefault();
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [viewedPly, livePly, onScrub]);
```

- [ ] **Step 2: Verify TypeScript + lint**

```bash
bunx tsc --noEmit && bun run lint
```

Expected: pass.

- [ ] **Step 3: Manual smoke**

In `/games/<id>`:
- ArrowLeft -> board steps back one ply
- ArrowRight -> board steps forward
- ArrowUp -> board jumps to start
- ArrowDown -> board snaps to live (viewedPly = null)
- Type into account `displayName` input (different page) -> arrows don't intercept text cursor

- [ ] **Step 4: Commit**

```bash
git add app/games/[gameId]/MoveList.tsx
git commit -m "feat(game): keyboard nav on move list (arrows + up/down jumps)

Window-level keydown listener mounted by MoveList:
- ArrowLeft / ArrowRight step viewedPly by 1, clamped to [0, livePly]
- ArrowUp jumps to ply 0 (start of game)
- ArrowDown jumps to live (viewedPly = null)

Skips when target is input / textarea / contenteditable so typing
in form fields elsewhere on the page doesn't hijack arrows.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Audio + Your-turn toast

**Files:**
- Create: `public/sounds/move.mp3`
- Create: `public/sounds/README.md`
- Modify: `app/games/[gameId]/GameClient.tsx`

- [ ] **Step 1: Source the audio asset**

Download lichess `Standard/Move.mp3` (CC-BY 4.0):

```bash
mkdir -p public/sounds
curl -sf -o public/sounds/move.mp3 \
  "https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Move.mp3"
ls -la public/sounds/move.mp3
```

Expected: file exists, size 5-15 KB.

- [ ] **Step 2: Write attribution**

Create `public/sounds/README.md`:

```md
# Sounds

## move.mp3

- Source: lichess `public/sound/standard/Move.mp3`
- License: CC-BY 4.0
- Attribution: lichess.org

Updated: 2026-05-09. If the lichess upstream changes its asset, the local
copy stays as-is unless explicitly refreshed.
```

- [ ] **Step 3: Wire audio + toast in GameClient**

Inside `GameClient`, near the existing useEffects, add:

```tsx
import { toast } from "sonner";

// Audio ref
const audioRef = useRef<HTMLAudioElement | null>(null);
useEffect(() => {
  const a = new Audio("/sounds/move.mp3");
  a.volume = 0.5;
  a.preload = "auto";
  audioRef.current = a;
}, []);

// Cue + toast on livePly bump
const prevLivePlyForCue = useRef(livePly);
useEffect(() => {
  if (livePly === 0) return;
  if (livePly === prevLivePlyForCue.current) return;
  prevLivePlyForCue.current = livePly;

  // Audio (every move, own + opponent)
  const a = audioRef.current;
  if (a) {
    a.currentTime = 0;
    a.play().catch(() => {
      // Browser autoplay policy: first call before user interaction may
      // reject. Subsequent calls unlock once user has interacted with the
      // page anywhere (clicking sign-in, board, etc).
    });
  }

  // Toast on Your turn (player perspective only, in_progress only)
  if (
    isPlayer &&
    state.status === "in_progress" &&
    state.currentTurn === myColor
  ) {
    toast("Your turn.", { duration: 3500 });
  }
}, [livePly, isPlayer, state.status, state.currentTurn, myColor]);
```

(Implementer: `isPlayer` and `myColor` already exist in GameClient — locate the existing variables; do not redefine. If sonner's `toast` import isn't already at the top of the file, add it. The `Toaster` component is already mounted globally in `app/layout.tsx`.)

- [ ] **Step 4: Verify**

```bash
bunx tsc --noEmit && bun run lint
```

Expected: pass.

- [ ] **Step 5: Manual smoke (two browsers)**

Open `/games/<id>` in two browsers signed in as both players. White makes a move:
- White browser: audio plays, NO toast (own move)
- Black browser: audio plays, "Your turn." toast appears for ~3.5s

- [ ] **Step 6: Commit**

```bash
git add public/sounds/move.mp3 public/sounds/README.md app/games/[gameId]/GameClient.tsx
git commit -m "feat(game): wooden-thunk audio cue + Your-turn toast on livePly bump

Audio: lichess Standard/Move.mp3 (CC-BY 4.0), 0.5 volume, plays on
every livePly bump for both players. Catches browser autoplay-policy
rejection on first load before any interaction.

Toast: sonner 'Your turn.' fires only when (isPlayer && in_progress
&& state.currentTurn === myColor). Skipped for observers and for the
moves' own author.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Animations + auto-scroll

**Files:**
- Modify: `app/games/[gameId]/MoveList.tsx`

- [ ] **Step 1: Add GSAP entry stagger + per-arrival fade**

Inside `MoveList`, near the keyboard useEffect, add:

```tsx
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";

// Inside MoveList component, after other hooks:
const containerRef = useRef<HTMLDivElement | null>(null);

// Initial mount: fade-up the last 8 cells with 50ms stagger
useGSAP(
  () => {
    const recentCells = containerRef.current?.querySelectorAll(
      ".move-cell[data-recent]",
    );
    if (!recentCells || recentCells.length === 0) return;
    gsap.from(recentCells, {
      opacity: 0,
      y: 8,
      duration: 0.2,
      stagger: 0.05,
      ease: "power2.out",
    });
  },
  { scope: containerRef, dependencies: [] },
);

// New move arrives: fade-up the newest cell only
useGSAP(
  () => {
    const cells = containerRef.current?.querySelectorAll(".move-cell");
    if (!cells || cells.length === 0) return;
    const newest = cells[cells.length - 1];
    gsap.from(newest, {
      opacity: 0,
      y: 8,
      duration: 0.2,
      ease: "power2.out",
    });
  },
  { scope: containerRef, dependencies: [moves.length] },
);
```

Then attach the ref to the outer scrollable div in the JSX:

```tsx
<div
  ref={containerRef}
  className="w-full max-w-xl mx-auto px-1 py-2 max-h-72 overflow-y-auto"
  data-testid="move-list"
>
  {/* ...existing grid... */}
</div>
```

- [ ] **Step 2: Add auto-scroll into view (skip when in review mode)**

Below the GSAP hooks, add:

```tsx
useEffect(() => {
  if (viewedPly !== null) return; // skip while user is reviewing
  const cells = containerRef.current?.querySelectorAll(".move-cell");
  if (!cells || cells.length === 0) return;
  const newest = cells[cells.length - 1];
  newest.scrollIntoView({ behavior: "smooth", block: "nearest" });
}, [moves.length, viewedPly]);
```

- [ ] **Step 3: Verify**

```bash
bunx tsc --noEmit && bun run lint
```

Expected: pass.

- [ ] **Step 4: Manual smoke**

Open a long game (50+ moves):
- On page load, last 8 moves fade-up with stagger; older moves render instant
- New move arrives via realtime: newest cell fades up + list smooth-scrolls to bring it into view
- Click a mid-game ply: list does NOT auto-scroll to latest on next move arrival (review mode preserves position; auto-snap-to-live overrides via viewedPly === null)

- [ ] **Step 5: Commit**

```bash
git add app/games/[gameId]/MoveList.tsx
git commit -m "feat(game): GSAP entry stagger + per-arrival fade + auto-scroll

useGSAP runs two timelines:
1. On mount, fade-up the last 8 cells (data-recent) with 50ms stagger
   (caps total animation at 400ms regardless of move count)
2. On moves.length change, fade-up the newest cell only (~200ms)

useEffect smooth-scrolls latest into view on append, but only when
viewedPly === null. While the user is scrubbed back, scroll position
is preserved.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: e2e spec + ship

**Files:**
- Create: `e2e/move-list-stepper.spec.ts`

- [ ] **Step 1: Read existing e2e helpers for patterns**

```bash
ls e2e/lib/
cat e2e/lib/auth-helper.ts | head -40
```

Match the patterns used by `e2e/multiplayer-untimed.spec.ts` (existing two-browser game test) for context creation, auth, game seed, and move dispatch.

- [ ] **Step 2: Write the spec**

Create `e2e/move-list-stepper.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
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
  email: "movelist-alice@narrativechess.test",
  password: "movelist-pw-alice",
};
const BOB = {
  email: "movelist-bob@narrativechess.test",
  password: "movelist-pw-bob",
};

test("move-list stepper renders + scrubs + auto-snaps", async ({
  browser,
  baseURL,
}) => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const aliceUser = await ensureUser(ALICE.email, ALICE.password);
  const bobUser = await ensureUser(BOB.email, BOB.password);

  // Seed a game with 4 moves so the panel has visible rows on first paint.
  const startingFen =
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const inserted = await admin
    .from("games")
    .insert({
      white_id: aliceUser.id,
      black_id: bobUser.id,
      status: "in_progress",
      current_fen: "rnbqkb1r/pppppppp/5n2/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 1 2",
      current_turn: "b",
      ply: 4,
    })
    .select("id")
    .single();
  if (inserted.error) throw inserted.error;
  const gameId = inserted.data.id;

  // Insert 4 moves matching that current_fen
  await admin.from("game_moves").insert([
    { game_id: gameId, ply: 1, san: "e4", uci: "e2e4",
      fen_after: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      played_by: aliceUser.id },
    { game_id: gameId, ply: 2, san: "Nf6", uci: "g8f6",
      fen_after: "rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2",
      played_by: bobUser.id },
    { game_id: gameId, ply: 3, san: "d4", uci: "d2d4",
      fen_after: "rnbqkb1r/pppppppp/5n2/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2",
      played_by: aliceUser.id },
  ]);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAs(ctx, page, ALICE.email, ALICE.password, baseURL!);

  await page.goto(`${baseURL}/games/${gameId}`);

  // Move list panel exists with all moves
  const list = page.getByTestId("move-list");
  await expect(list).toBeVisible();
  await expect(list.locator(".move-cell")).toHaveCount(3);

  // Click ply 1 -> board state probe should show ply scrubbed
  // (board itself isn't easy to assert via DOM; we assert the cell's
  // active-state class instead)
  await list.locator("[data-ply='1']").click();
  await expect(list.locator("[data-ply='1']")).toHaveClass(/bg-oxblood/);

  // ArrowDown returns to live
  await page.keyboard.press("ArrowDown");
  await expect(list.locator("[data-ply='3']")).toHaveClass(/bg-oxblood/);

  // ArrowUp jumps to start (no cell active because ply 0 has no cell)
  await page.keyboard.press("ArrowUp");
  await expect(list.locator(".move-cell.bg-oxblood")).toHaveCount(0);

  // ArrowRight steps forward from start
  await page.keyboard.press("ArrowRight");
  await expect(list.locator("[data-ply='1']")).toHaveClass(/bg-oxblood/);

  await ctx.close();
});

test("opponent move auto-snaps board back to live", async ({
  browser,
  baseURL,
}) => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const aliceUser = await ensureUser(ALICE.email, ALICE.password);
  const bobUser = await ensureUser(BOB.email, BOB.password);

  const startingFen =
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const inserted = await admin
    .from("games")
    .insert({
      white_id: aliceUser.id,
      black_id: bobUser.id,
      status: "in_progress",
      current_fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      current_turn: "b",
      ply: 1,
    })
    .select("id")
    .single();
  if (inserted.error) throw inserted.error;
  const gameId = inserted.data.id;
  await admin.from("game_moves").insert({
    game_id: gameId, ply: 1, san: "e4", uci: "e2e4",
    fen_after: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    played_by: aliceUser.id,
  });

  const aliceCtx = await browser.newContext();
  const alicePage = await aliceCtx.newPage();
  await loginAs(aliceCtx, alicePage, ALICE.email, ALICE.password, baseURL!);
  await alicePage.goto(`${baseURL}/games/${gameId}`);

  // Alice scrolls back to ply 0 (start of game)
  await alicePage.keyboard.press("ArrowUp");
  await expect(alicePage.locator(".move-cell.bg-oxblood")).toHaveCount(0);

  // Bob makes a move via service-role insert to simulate realtime
  await admin.from("game_moves").insert({
    game_id: gameId, ply: 2, san: "c5", uci: "c7c5",
    fen_after: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    played_by: bobUser.id,
  });
  await admin.from("games").update({
    current_fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    current_turn: "w",
    ply: 2,
  }).eq("id", gameId);

  // Auto-snap: ply 2 should now be active (latest)
  await expect(
    alicePage.locator(".move-cell[data-ply='2']"),
  ).toHaveClass(/bg-oxblood/, { timeout: 10000 });

  await aliceCtx.close();
});
```

- [ ] **Step 3: Run the spec**

```bash
bunx playwright test e2e/move-list-stepper.spec.ts --reporter=line
```

Expected: 2 passed, 0 failed (or 2 skipped if env vars not present locally — that's fine; CI will run with secrets).

- [ ] **Step 4: Run full suite to confirm nothing else broke**

```bash
bun run lint
bunx tsc --noEmit
bunx playwright test --reporter=line
```

Expected: all pass (count = pre-existing tests + 2 new, ~17 total).

- [ ] **Step 5: Commit + push**

```bash
git add e2e/move-list-stepper.spec.ts
git commit -m "test(e2e): move-list stepper - render, scrub, keyboard, auto-snap

Two specs:
1. Renders panel with 3 moves on first paint, click + ArrowLeft/Right/
   Up/Down all bind correctly, active highlight tracks viewedPly
2. Opponent move via service-role insert auto-snaps board back to
   live within 10s

Skipped when env vars absent (matches existing e2e gating pattern).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push -u origin feat/move-list-stepper
```

- [ ] **Step 6: Open PR feat -> dev**

```bash
gh pr create --base dev --head feat/move-list-stepper \
  --title "feat: move-list stepper (Polish B)" \
  --body "Implements docs/superpowers/plans/2026-05-09-move-list-stepper.md.

Read-only history panel below the player pills. Click + arrow-key
scrub, oxblood active highlight, auto-snap on opponent move,
wooden-thunk audio cue + Your-turn toast.

Spec: docs/superpowers/specs/2026-05-09-move-list-stepper-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 7: Wait for CI green**

Poll PR status. After lint-and-test SUCCESS, merge feat -> dev:

```bash
gh pr merge --merge
```

Then open dev -> main PR (squash, per branch policy):

```bash
gh pr create --base main --head dev \
  --title "ship: move-list stepper (Polish B)" \
  --body "Polish B from M1.5++ deferred queue. Read-only history panel
with click + keyboard scrub, audio cue, and Your-turn toast.

Plan: docs/superpowers/plans/2026-05-09-move-list-stepper.md
Spec: docs/superpowers/specs/2026-05-09-move-list-stepper-design.md"
```

After CI green, squash merge with `--admin` if branch protection blocks (per established pattern).

---

## Self-Review

**Spec coverage:**
- Goal: ✓ (Tasks 2 + 4 + 5)
- RSC fetch: ✓ Task 3
- Realtime accumulate: ✓ Task 4 step 4
- viewedPly + displayFen: ✓ Task 4
- Drag-lock: ✓ Task 4 step 3
- Auto-snap: ✓ Task 4 step 2
- MoveList grid: ✓ Task 2
- MoveCell active highlight: ✓ Task 2
- Empty state: ✓ Task 2 (`No moves yet.`)
- Keyboard nav: ✓ Task 5
- Audio cue: ✓ Task 6
- Your-turn toast: ✓ Task 6
- Animations (entry stagger + per-arrival): ✓ Task 7
- Auto-scroll: ✓ Task 7 step 2
- e2e: ✓ Task 8

**Type consistency:**
- `MoveLike` defined in Task 1, used in Tasks 2/4/7 — consistent
- `pairsFromMoves`, `viewedFen`, `stepPly` signatures stable across tasks
- `MoveEvent` from `lib/schemas/game` is the realtime payload type, `MoveLike` is the local subset — used consistently

**Placeholder scan:** clean, no TODO / TBD. Asset license already attributed via README.

**Scope check:** Single PR, ~8 files, focused. No decomposition needed.
