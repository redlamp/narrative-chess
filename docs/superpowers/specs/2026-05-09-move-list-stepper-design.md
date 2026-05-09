# Move List Stepper - Design

**Date:** 2026-05-09
**Status:** draft, awaiting user review
**Related:** Polish B per `wiki/projects/narrative-chess-v2.md`. Queued post-M1.5++.

## Goal

Add a review-only move history panel to the in-game page so players + observers can step through past plies, scrub the board to any past position, and resume live when the next move arrives. No undo. No editing.

## Scope

In:
- Read-only move list panel below the player pills
- Click + keyboard scrub
- Auto-snap board back to live when opponent (or self) plays a new move
- Audio cue + in-app toast on new move arrival
- Initial-load + per-arrival animations

Out (deferred):
- Per-move clock-time display (would need timestamp diff from `played_at`)
- Per-move evaluation / engine analysis
- Branch / variation editing
- Mobile drawer pattern (Polish C)
- Mute preference for audio (future settings panel)
- Capture / check / castle / promotion-distinct sounds (single thunk for v1)

## Architecture

```
app/games/[gameId]/
|- page.tsx              [SC]  parallel fetch: games + game_moves; pass initialMoves prop
|- GameClient.tsx        [CC]  owns viewedPly + audio + toast; passes scrub state to children
|- MoveList.tsx          [CC]  NEW. two-column grid, click + keyboard, GSAP animations
|- MoveCell.tsx          [CC]  NEW. single move button (oxblood active highlight)
lib/chess/
|- move-list.ts          [util] NEW. pair builder, viewed-FEN derivation, ply<->pair index helpers
public/sounds/
|- move.mp3              NEW. wooden thunk asset (lichess CC-BY or freesound CC0)
```

## Data flow

### Initial fetch (RSC)

`app/games/[gameId]/page.tsx` runs two parallel queries:

```ts
const supabase = await createClient();
const [gameRes, movesRes] = await Promise.all([
  supabase.from("games").select("...").eq("id", gameId).maybeSingle(),
  supabase.from("game_moves")
    .select("ply, san, fen_after, played_by, played_at")
    .eq("game_id", gameId)
    .order("ply", { ascending: true }),
]);

return <GameClient
  initialGame={gameRes.data}
  initialMoves={movesRes.data ?? []}
  ...
/>;
```

RLS on `game_moves` already permits SELECT for game participants + observers (per migration `20260502185717_init_games.sql`). No new policies.

### Realtime subscription (CC)

GameClient adds a second subscription mirroring the existing game-row subscription:

```ts
const [moves, setMoves] = useState<Move[]>(initialMoves);

useEffect(() => {
  // setAuth before subscribe per
  // ~/.claude/memory/tools/supabase-realtime-postgres-changes.md
  const session = await supabase.auth.getSession();
  await supabase.realtime.setAuth(session.data.session?.access_token);

  const ch = supabase
    .channel(`game_moves:${gameId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "game_moves",
        filter: `game_id=eq.${gameId}` },
      (payload) => {
        const m = payload.new as Move;
        setMoves(prev => {
          if (prev.some(x => x.ply === m.ply)) return prev;
          return [...prev, m].sort((a, b) => a.ply - b.ply);
        });
      },
    )
    .subscribe();

  return () => { supabase.removeChannel(ch); };
}, [gameId]);
```

## State model

### Two ply concepts in GameClient

```ts
type Move = { ply: number; san: string; fen_after: string;
              played_by: string; played_at: string };

const livePly = state.ply;                          // canonical from server
const [viewedPly, setViewedPly] = useState<number | null>(null);
const [moves, setMoves] = useState<Move[]>(initialMoves);
```

`viewedPly === null` means "follow live". Click a past move -> `setViewedPly(n)`.

### Display FEN derivation

```ts
const displayFen = useMemo(() => {
  if (viewedPly === null || viewedPly === livePly) return state.fen;
  const m = moves.find(m => m.ply === viewedPly);
  return m?.fen_after ?? state.fen;
}, [viewedPly, livePly, state.fen, moves]);
```

`<Chessboard position={displayFen} arePiecesDraggable={viewedPly === null || viewedPly === livePly} />` - drag locked while scrubbed.

### Auto-snap (when livePly bumps)

```ts
const prevLivePly = useRef(livePly);
useEffect(() => {
  if (livePly !== prevLivePly.current) {
    setViewedPly(null);                  // jump to live
    prevLivePly.current = livePly;
  }
}, [livePly]);
```

## MoveList component

### Props

```ts
type Props = {
  moves: Move[];
  livePly: number;
  viewedPly: number | null;
  onScrub: (ply: number | null) => void;
};
```

### Layout

Below the player pills inside GameClient's container, full-width up to `max-w-xl` to match the board column.

```
+------------------------------------------------+
| #  | white move      | black move              |
+------------------------------------------------+
| 1  | e4              | c5                      |
| 2  | Nf3             | d6                      |
| 3  | d4              | cxd4                    |
| ...                                            |
| 24 | (active-styled) | -                       |
+------------------------------------------------+
```

`font-mono`, two-column grid via CSS grid `grid-cols-[40px_1fr_1fr]`. Each move cell is a `<button data-ply={n}>` for click + e2e specs.

Empty trailing cell (white played but black hasn't) renders as `<td>` with no content.

### Active highlight

`viewedPly` cell (or latest cell if `viewedPly === null`) gets:
- `bg-oxblood text-cream` (matches accent token)
- `transition-colors` 200ms

Non-active cells: `bg-transparent text-foreground hover:bg-bg-soft`

(User noted may revise after seeing live; design captures intent, not commitment.)

### Empty state

`ply === 0`: panel shows `<p class="font-body italic text-ink-soft">No moves yet.</p>`

## Keyboard navigation

Window-level `keydown` listener inside MoveList. Skips text inputs:

```ts
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t?.matches?.("input, textarea, [contenteditable]")) return;
    if (e.key === "ArrowLeft")       step(-1);
    else if (e.key === "ArrowRight") step(+1);
    else if (e.key === "ArrowUp")    onScrub(0);
    else if (e.key === "ArrowDown")  onScrub(null); // null = follow live
    else return;
    e.preventDefault();
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [step, onScrub]);

function step(delta: number) {
  const current = viewedPly ?? livePly;
  const next = Math.max(0, Math.min(livePly, current + delta));
  onScrub(next === livePly ? null : next);
}
```

## Animations

GSAP via `useGSAP` from `@gsap/react` (already pinned; no new deps).

### Initial render

Render all moves immediately (no stagger by default). On mount, fade-up the **last 8** moves with 50ms stagger:

```ts
useGSAP(() => {
  const recent = ref.current.querySelectorAll(".move-row[data-recent]");
  gsap.from(recent, {
    opacity: 0, y: 8,
    duration: 0.2,
    stagger: 0.05,
    ease: "power2.out",
  });
}, { scope: ref, dependencies: [] });
```

Caps total animation at 400ms regardless of game length. Server-side, mark the last 8 rows with `data-recent` attribute.

### Per-arrival fade

When `moves.length` increases (new move appended via realtime), fade-in the newest row:

```ts
useGSAP(() => {
  const newest = ref.current.querySelector(".move-row:last-child");
  if (newest) {
    gsap.from(newest, { opacity: 0, y: 8, duration: 0.2, ease: "power2.out" });
  }
}, { scope: ref, dependencies: [moves.length] });
```

### Auto-scroll behavior (Q4 option 2)

When `moves.length` increases AND `viewedPly === null`, smoothly scroll the panel to keep the latest row in view. Skip auto-scroll when scrubbed back (respects user's review position).

```ts
useEffect(() => {
  if (viewedPly !== null) return;
  ref.current?.querySelector(".move-row:last-child")?.scrollIntoView({
    behavior: "smooth", block: "nearest",
  });
}, [moves.length, viewedPly]);
```

## Audio cue

```ts
// In GameClient mount
const audioRef = useRef<HTMLAudioElement>(null);

useEffect(() => {
  audioRef.current = new Audio("/sounds/move.mp3");
  audioRef.current.volume = 0.5;
  audioRef.current.preload = "auto";
}, []);

function playMoveSound() {
  const a = audioRef.current;
  if (!a) return;
  a.currentTime = 0;
  // Catch + ignore autoplay-policy rejection (first load before any user interaction)
  a.play().catch(() => { /* user hasn't interacted yet; subsequent plays will work */ });
}
```

Fires once per `livePly` bump. NOT during scrub.

```ts
const prevLivePlyForAudio = useRef(livePly);
useEffect(() => {
  if (livePly === 0) return;
  if (livePly === prevLivePlyForAudio.current) return;
  playMoveSound();
  prevLivePlyForAudio.current = livePly;
}, [livePly]);
```

### Asset sourcing

Source `move.mp3` from one of:
- **lichess sounds repo** (CC-BY attribution) - `Standard/Move.mp3` from `https://github.com/lichess-org/lila/tree/master/public/sound/standard`
- **freesound.org CC0** - search "wooden chess" / "wood thunk"
- **self-record** - tap finger on wood, edit + normalize

Decide during implementation. License + attribution recorded in `public/sounds/README.md`.

## In-app toast on opponent move

Uses existing `sonner` (already imported in `app/layout.tsx` for live-game / lobby toasts).

```ts
useEffect(() => {
  if (livePly === 0) return;
  if (livePly === prevLivePlyForToast.current) return;

  if (isPlayer && state.status === "in_progress") {
    const isMyTurn = state.currentTurn === myColor;
    if (isMyTurn) {
      toast("Your turn.", { duration: 3500 });
    }
  }
  prevLivePlyForToast.current = livePly;
}, [livePly, state.currentTurn, state.status]);
```

Skipped when:
- Viewer is observer (`isPlayer === false`)
- Game terminal (`state.status !== "in_progress"`)
- It's NOT viewer's turn (i.e., the bump was viewer's own move)

## Edge cases

| Case | Behavior |
|---|---|
| `ply === 0` (no moves yet) | Panel shows "No moves yet." (italic Newsreader, ink-soft) |
| Observer perspective | Same UI, can scrub. No "Your turn" toast. Audio plays normally. |
| Finished game | `viewedPly` persists; auto-snap doesn't fire since `livePly` stable. Latest ply highlighted by default. |
| Drag while in review | `arePiecesDraggable = viewedPly === null \|\| viewedPly === livePly` |
| First move odd ply (white played, black hasn't) | Row shows white SAN + empty black cell |
| User makes own move while scrubbed back | optimistic update bumps `livePly` -> auto-snap effect fires -> `setViewedPly(null)` -> board returns to live |
| Realtime arrives out-of-order | `setMoves(prev => [...prev, m].sort((a, b) => a.ply - b.ply))` (handled in subscription) |
| Audio blocked on first load | `audio.play()` returns rejected Promise; `.catch(() => {})` swallows. Subsequent plays unlock after any user interaction. |

## Testing strategy

### Unit (vitest)

- `lib/chess/move-list.ts`:
  - `pairsFromMoves(moves)` returns `[{ moveNum, white, black }]` with empty black on odd-length tail
  - `viewedFen(moves, viewedPly, liveFen)` returns `liveFen` when `viewedPly === null`
  - `viewedFen(moves, viewedPly, liveFen)` returns `moves.find(m => m.ply === viewedPly).fen_after` when valid

### E2E (Playwright)

`e2e/move-list-stepper.spec.ts`:
- Two-browser smoke: white plays e4, black sees move appear in list within 5s
- Click ply 1 -> board shows post-e4 fen, ply-1 cell has active highlight
- Click ply 0 -> board shows starting fen
- Press ArrowLeft on a mid-game position -> viewedPly decrements
- Press ArrowDown -> viewedPly resets to null, board snaps to live
- New move arrives via realtime -> board snaps to live, list scrolls to latest
- Observer perspective: scrubbing works, no "Your turn" toast fires

## Open questions for review

1. **Audio asset license**: lichess CC-BY (must attribute) vs CC0 (no obligation). User preference?
2. **Toast copy**: "Your turn." vs "Opponent moved." vs "Your move."?
3. **Active highlight visual**: oxblood/cream (per Q7) tentative. May revise after seeing.
4. **Mute preference**: defer to future settings panel, or include silent localStorage toggle in v1?

## Implementation phasing

To be detailed in the implementation plan, but rough shape:

1. **P1**: `lib/chess/move-list.ts` + unit tests (DRY foundation)
2. **P2**: `MoveList.tsx` + `MoveCell.tsx` (presentational, no realtime yet)
3. **P3**: Wire RSC fetch in `page.tsx` + pass to GameClient
4. **P4**: Wire viewedPly state + displayFen + drag-lock + auto-snap in GameClient
5. **P5**: Realtime subscription for `game_moves`
6. **P6**: Audio + toast on livePly bump
7. **P7**: Animations (GSAP entry stagger + per-arrival fade + auto-scroll)
8. **P8**: e2e spec + ship
