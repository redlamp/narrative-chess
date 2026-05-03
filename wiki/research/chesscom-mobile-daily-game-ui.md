---
tags:
  - domain/chess-engine
  - origin/external-research
---

# Chess.com Mobile — Daily Game UI (Pixel 6 Pro)

**Type:** screenshots
**Author / Channel:** Chess.com mobile app (Android)
**Captured:** 2026-05-03
**Device:** Pixel 6 Pro
**Source:** chess.com Android app, daily/correspondence game view

## Captures

![[assets/chesscom-mobile-game1-midgame.png]]

![[assets/chesscom-mobile-game2-midgame.png]]

## Layout breakdown

Top → bottom, in a single scroll-free column:

1. **Top app bar** — back chevron (left), Chess.com wordmark + king-pawn glyph (centre). No avatar/menu on right. Pure black background.
2. **Move ribbon** — last ~5 plies in algebraic with figurine pieces, scrollable horizontally. Current move highlighted in a darker grey pill (`h5` shot 1, `xc5` shot 2). Move numbers dim grey, ply text white. Ellipsis pattern `2.` / `13.` shows partial move pairs.
3. **Opponent strip** — avatar (32px round), username, rating in parens, country flag, optional title icon, captured-piece glyphs + material delta (`+1`, `+8`). Right side: clock pill with timer icon and remaining time (`22 hours`, `3 days`).
4. **Board** — full-width square. Files `a–h` and ranks `1–8` printed inside the squares (rank labels at left edge of each row, file labels at bottom of bottom row). Two-tone green/cream classic chess.com palette. Last-move highlight is a yellow-green tint on both source + destination square (visible on `xc5` shot — c5 destination + presumed source). Pieces are flat 2D illustrations, not 3D.
5. **Player strip** (self) — mirror of opponent strip. Clock pill on the right (black-bg variant when it's your move — shot 1 — vs white-bg when it's the opponent's — shot 2).
6. **Bottom action bar** — 5 evenly spaced icons + labels: Options (hamburger), Chat (speech bubble), Analyze (magnifier with `+`), Back (`<`), Forward (`>`). Sits on dark grey, no border. Persistent across the screen, no tab-bar pattern.

## Content & state notes

- **Game cadence is async** — clock shows days/hours, not minutes/seconds. This is daily/correspondence mode, not blitz. Matters: UI needs to handle a "your turn" affordance that survives app close + push notifications.
- **Material delta surfaced inline** — captured-piece glyphs + numeric `+N` next to each player. Cheap signal, no separate evaluation panel. Worth copying.
- **Move list is one-line, horizontally scrollable** — not a two-column table. Saves vertical real estate on mobile. Cursor pill marks current ply.
- **Board orientation is from active player's POV** — chaosmonaut (self) is at the bottom in both shots. Standard.
- **No engine eval bar / no narration / no chat preview** — chess.com keeps the play surface clean. Chat lives behind the bottom-bar icon.
- **Rank/file labels are inside the squares**, not in a gutter. Saves ~20–30px width on a phone where every pixel counts. Subtle dark-on-cream / light-on-green typography keeps them legible without dominating.
- **No safe-area padding visible at bottom** — bottom bar sits flush against the gesture region. On Pixel 6 Pro this is fine; iOS would need extra inset.

## Why it matters here

Useful baseline for V2's mobile-first board view. Specific takeaways:

- **Symmetric player strips above + below the board** is the canonical pattern. Already partially mirrored in our `GameClient` layout — confirms direction.
- **Inline rank/file labels** are worth lifting if `react-chessboard` supports it; gutter labels eat width we don't have on mobile.
- **Last-move highlight as full-square tint** (vs an arrow / dot) is more legible at thumb-size than overlays. Cheap to implement.
- **Captured-piece + material delta strip** is a Phase-6+ feature worth scoping — small surface, high signal.
- **Bottom action bar with Options / Chat / Analyze / Back / Forward** is a clean nav skeleton. Our analogue: we'll need narration toggle + move-list jump, but the 5-slot bottom bar pattern translates.
- **Daily-mode UX** (clock in days, "your turn" surfaced via push) is a different product than what we're building first (live realtime), but worth noting if we ever extend to async games — the chrome stays the same, only the clock unit changes.

Open question: chess.com puts the move ribbon *above* both player strips. We currently put move history below the board. Worth A/B-ing once we have a builds for both.

## Related

- [[mocs/research]]
- [[mocs/game-design]]
