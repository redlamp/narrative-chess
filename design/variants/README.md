# Frontend Pass 1 — Design Variants

Four standalone HTML mockups, one per aesthetic direction. Each commits fully to its POV — typography, color, spatial composition, motion teaser. Real chess content; no lorem ipsum.

## Viewing

Open each `.html` directly in a browser:

```
file:///C:/workspace/narrative-chess-v2/design/variants/01-editorial.html
file:///C:/workspace/narrative-chess-v2/design/variants/02-cartographic.html
file:///C:/workspace/narrative-chess-v2/design/variants/03-brutalist-terminal.html
file:///C:/workspace/narrative-chess-v2/design/variants/04-heritage-club.html
```

Or run a quick static server: `bunx serve design/variants` then visit `http://localhost:3000`.

## Variants

### 01 — Editorial (NYT Magazine / Paris Review / McSweeney's)

- **Display:** Fraunces (variable serif w/ optical-size + WONK + SOFT axes)
- **Body:** Newsreader (variable serif, magazine-grade)
- **Palette:** cream `#f3ece1`, ink `#1a1815`, oxblood `#7a1f25`
- **Anchors:** masthead w/ live-game pill, drop-cap lede, footnoted stats, "from the archive" feature slot (M2 hook), 4px double-rule footer
- **Voice:** "We publish each game as a piece of literature."
- **Why this could win:** Narrative Chess *is* a magazine name. Solves M2 layout problem (cities/characters/beats slot natively into editorial cards). No chess platform looks like this.

### 02 — Cartographic / Atlas (old expedition logs, Wes Anderson maps)

- **Display + body:** Spectral + Spectral SC (Bodoni-adjacent, atlas-grade)
- **Palette:** parchment `#ebe1c8`, sepia ink `#2c2418`, plot red `#8a3a28`, tide `#4a6878`, military `#5a6b4a`
- **Anchors:** compass-rose header, latitude/longitude grid (subtle, fixed, masked), Plate I bordered hero, embossed "ticket" CTAs, coordinate-style stat plates, city tags as M2 preview, scale-bar footer
- **Voice:** "Each game crosses cities, gathers characters, leaves a route."
- **Why this could win:** M2 narrative layer is literally cities/characters/routes — the metaphor is already cartographic. Aged paper + grid creates atmosphere chess platforms never have.

### 03 — Brutalist Terminal (text-mode chess engines, ttyrec, swiss grid)

- **Display + body:** JetBrains Mono Variable (monospaced, all of it)
- **Palette:** bone `#f0eadc` on near-black `#0a0907`, accent `#e44d26` (terminal-warning red), phosphor green `#2d5a2d` (ok)
- **Anchors:** ANSI status bar, ASCII-framed hero w/ blinking caret + typed command, hard-edged keyboard-shortcut CTAs, tabular telemetry, real PGN move-log preview ending mid-move at cursor
- **Voice:** Terse, build-SHA-stamped, system-status flavored.
- **Why this could win:** Terminal banner already exists in the game UI — this would unify the whole product around it. Fastest to build in code (mono-font + hairlines = simple).

### 04 — Heritage Club (Reuben classic set, Penguin Modern Classics, lounge)

- **Display:** Italiana (high-contrast classical)
- **Body:** Cormorant Garamond (book-grade serif)
- **Palette:** walnut `#2a1c14`, cream `#ebe1ce`, oxblood `#6b1a1a`, brass-foil gradient (`#d4b558 → #8a6f25`)
- **Anchors:** centered formal masthead w/ ♚ crest + Roman edition number, brass-foil wordmark (CSS gradient text), filigree divider, embossed gold "Begin a Game" button, Roman-numeral stat plates w/ Arabic glosses, framed quotation panel
- **Voice:** "A Society for the Reading of Games."
- **Why this could win:** Heritage feel matches the gravitas of slow correspondence chess. The brass-foil button alone reads more luxurious than any chess product on the market.

## What each mockup ships

- Hero + tagline + 2 CTAs
- 3 stat panels (12 live / 47 today / 1,243 moves)
- Footer / colophon
- One narrative-layer M2 hook (archive feature, city tags, move-log, charter quote)
- CSS-only motion teaser (staggered on-load reveal — proxy for the GSAP timeline that would replace it in the React port)

## What each mockup does NOT ship

- The 3D hero (R3F) — kept conceptually in `01` & `02`, dropped in `03` & `04`. Real implementation will have to decide.
- Light/dark theme variants — each variant locks one mode (cream-light for `01`/`02`/`03`, walnut-dark for `04`). Real port needs both.
- Dialog / form / lobby / game page — landing only. Once direction is picked, derive the rest.

## Decision criteria

When picking, weigh these:

| Criterion | 01 Editorial | 02 Cartographic | 03 Terminal | 04 Heritage |
|---|---|---|---|---|
| Differentiation vs chess.com / lichess | high | very high | very high | high |
| M2 narrative layer fit | very high | very high | low | medium |
| Implementation cost | medium | high (texture, ornament) | low | medium (foil, ornaments) |
| Light + dark coherence | natural | natural-light only | natural | natural-dark only |
| Risk of feeling dated in 18 months | low | medium (texture trend) | low | low |
| Headline 3D hero compatibility | yes | yes (terrain) | no | maybe (foil chess piece) |
| Tone fit for slow correspondence games | high | very high | medium | very high |
| Tone fit for fast 5+0 games | medium | low | high | low |

Pick a primary. Then we either lock it in for the React port or sketch a hybrid before committing.
