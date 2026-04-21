# Mobile Support Plan

## Context

Narrative-chess is desktop-first today. The board is a custom React grid using HTML5 drag-and-drop; the match workspace is a 3-panel layout anchored by an absolute-positioned drag/resize `StoryPanel`; page navigation is a horizontal tab row in the header. The viewport meta tag is already correct and a `useIsMobile()` hook (768px) plus a Vaul `Drawer` component already exist but are barely used.

Goal: make the app usable on a ~375px-wide phone without rewriting layout foundations. Keep desktop untouched. Prefer `isMobile` / `(pointer: coarse)` branches over a parallel mobile app.

## Stack reminders

React 19, Vite, Tailwind 4, shadcn/ui + Radix, Vaul (drawer), gsap. No react-router — pages via `?page=` query param in `App.tsx`.

## Approach (phased)

### Phase 1 — Foundation (S)
Low-risk prerequisites that unblock everything else.

- **`100vh` → `100dvh`** with `@supports` fallback at:
  - `apps/web/src/styles.css` lines 152, 932, 1983
  - `apps/web/src/components/FloatingLayoutPanel.tsx` (inline `maxHeight` calc)
- **`use-coarse-pointer.ts` hook** — new file, matches `(pointer: coarse)` via `matchMedia`. Separate from `useIsMobile` (width-based) because tablets-with-stylus need the pointer signal, not viewport width.
- **Hover-gate CSS** — wrap decorative hover rules in `@media (hover: hover)` so hover-only hidden controls always show on touch. Audit hits in `styles.css`: `.board-square:hover`, `.workspace-list-item:hover`, `.match-history__scrubber:hover`, and any `LayoutToolbar` / `PageLayoutToolbar` hover-reveal.

### Phase 2 — Board touch input (S)
Single highest-impact change.

- `apps/web/src/components/Board.tsx:367` — change `draggable={!!onSquareDrop}` to `draggable={!!onSquareDrop && !isCoarsePointer}`. Tap-to-select + tap-target already exists via `onClick={handleClick}` + `legalMoves` highlighting.
- Do **not** introduce `@dnd-kit`. HTML5 DnD stays for desktop; touch uses the existing click path, which is also the keyboard-a11y path.
- Verify: selected-square highlight is visible without hover assistance; arrow-key nav still works (untouched).

### Phase 3 — Mobile navigation shell (M)
- New `apps/web/src/components/MobileNavDrawer.tsx` — Vaul left-side drawer, lists the same page tabs + user menu + app menu.
- In `apps/web/src/App.tsx` header, branch on `useIsMobile()`: hamburger trigger on mobile, current tab row on desktop. Keep status cards visible but collapsed (icon-only) on mobile.
- Reuse the existing page config array; don't duplicate the route list.

### Phase 4 — Match workspace mobile layout (L)
Largest surface. Keep desktop layout exactly as-is.

- `apps/web/src/components/MatchWorkspacePage.tsx` — when `isMobile`, render: Board (square via `aspect-ratio: 1/1`, full width) + a tab strip (Story / Study / History / Map) in a single region below. Tabs beat a second drawer here because users flip panels mid-move.
- `apps/web/src/components/StoryPanel.tsx` — early-return a stacked mode on mobile: render the same `StoryBeatSection` / `StoryCharacterSection` / `StoryCityTileSection` children as a plain vertical column, skip the absolute grid and drag-resize handles.
- `apps/web/src/storyPanelLayoutState.ts` — gate reads/writes behind `!isMobile` so a mobile session doesn't overwrite desktop layout persistence.
- `apps/web/src/components/FloatingLayoutPanel.tsx` — on mobile, short-circuit to non-floating static positioning; stop reading `window.innerWidth` / `innerHeight` there.

### Phase 5 — Secondary pages (M)
Audit each at 375px: `ClassicGamesLibraryPage`, `CityReviewPage`, `RoleCatalogPage`, `ResearchPage`, `DesignPage`. Most only need single-column stacking and container-query tweaks; Tailwind responsive utilities already present on some.

### Phase 6 — Polish (S)
- Tooltips carrying unique info → swap to `Popover` on mobile (Radix Tooltip long-press works for decorative labels, not for action-critical content).
- `FloatingLayoutPanel` orientation-change re-measure (already partial — tighten).
- Hit-target audit: ensure interactive elements ≥ 44px on touch.
- Header status-card collapse to icons on narrow widths.

## Breakpoints

Keep existing custom CSS breakpoints (760 / 900 / 1080 / 1280 / 1360) — they encode real layout inflections and rewriting is busywork. Add one JS breakpoint via `useIsMobile` (768) and one pointer media query (`pointer: coarse`) as the only new conventions. Document at top of `styles.css`.

## Critical files

- `apps/web/src/App.tsx` — header branch + mobile nav integration
- `apps/web/src/components/MatchWorkspacePage.tsx` — mobile layout branch
- `apps/web/src/components/StoryPanel.tsx` — stacked mode
- `apps/web/src/components/Board.tsx` — line 367 coarse-pointer guard
- `apps/web/src/components/FloatingLayoutPanel.tsx` — skip window sizing on mobile
- `apps/web/src/styles.css` — `dvh`, hover gates, mobile stacking rules
- `apps/web/src/storyPanelLayoutState.ts` — gate persistence
- **New:** `apps/web/src/hooks/use-coarse-pointer.ts`
- **New:** `apps/web/src/components/MobileNavDrawer.tsx`

## Reuse (don't rebuild)

- `apps/web/src/hooks/use-mobile.ts` — existing width hook
- `apps/web/src/components/ui/drawer.tsx` — Vaul drawer already wired
- `apps/web/src/components/Panel.tsx` — landscape-aware via ResizeObserver; reuse as tab content
- Board's existing `onClick` + `legalMoves` + `onFocus` keyboard path is the touch path — no new input layer needed

## Verification

1. **Touch move flow** (iOS Safari + Android Chrome): tap piece → targets highlight → tap target → move commits. No drag needed.
2. **Viewport**: rotate device; board stays square; no content cut off by address bar collapse.
3. **Desktop regression**: on `md+`, all existing behavior unchanged (drag-to-move, absolute StoryPanel grid, floating panels). Run existing tests — `apps/web/src/activeGames.test.ts`, `packages/game-core/src/index.test.ts`, `apps/web/src/storyPanelLayoutState.test.ts`.
4. **Mobile nav**: hamburger opens drawer, page switch works, back gesture doesn't trap focus.
5. **Orientation**: portrait and landscape phones; landscape should give board ≥ 60% of viewport width.
6. **Pointer signal**: test on a touch-screen laptop — coarse-pointer guard must not fire when mouse is primary.
7. **Performance**: board ResizeObserver shouldn't thrash on virtual-keyboard show/hide (check in a message-input flow).
8. **Layout persistence**: open on mobile then desktop — desktop layout intact.

## Out of scope

- Native app wrapper (Capacitor / React Native).
- Gesture features unique to touch (swipe-between-moves, pinch-zoom-board).
- Full `@dnd-kit` migration.
- Offline / PWA install.
