---
tags:
  - domain/stack
  - status/adopted
  - scope/foundation
---

# Narrative Chess V2

Rewrite of [[narrative-chess-v1]]. Chess-first rebuild with narrative layer, designed AI-collaboration-friendly from day one.

## Status

- Started: 2026-05-02
- **M1 shipped: 2026-05-03.** Phases 1–6 all in production. Squash-merged via PR #12 (`e81a3d9` on `main`).
- **M1.5 shipped: 2026-05-04.** Phase 7 + terminal banner fix + header nav + Phase 8 landing/3D hero. Squash-merged via PR #18 (`681f809` on `main`).
- **M1.5+ shipped: 2026-05-04.** Hero3D WebGL context recovery + AuthDialog onSuccess + theme toggle UI + dev-only fool's mate smoke + husky pre-commit shebang chore. Squash-merged via PR #25 (`67243d5` on `main`).
- **M1.5++ shipped: 2026-05-06.** Clocks (live + correspondence), per-side timeout detection (lazy + auto-claim + daily cron sweep), strict-reconnect policy + post-merge polish (hydration fix, open-challenges visibility, account page + display name in header, live games lobby + game-started toast, drop redundant Home link, home stat panels + vertical-stack layout). Squash-merged via PR #34 (`5706e2b` on `main`). 6 migrations live on hosted Supabase. CRON_SECRET set in Vercel envs (Production + Preview/dev). Spec + plan at `docs/superpowers/specs/2026-05-05-clocks-timeout-reconnect-design.md` and `docs/superpowers/plans/2026-05-05-clocks-timeout-reconnect.md`.
- **Design pass shipped: 2026-05-08.** Editorial-hybrid theme. Fraunces + Newsreader + JetBrains Mono fonts, ink + cream + oxblood + signal palette (replaces shadcn-default teal), 3D hero rebuilt with walnut plinth + 5-piece cluster + GSAP entrance + theme-aware materials, new StageOverlay + StageCtas + LiveGameCard components, typography pass on game / auth / account / lobby pages, Three.js + oklch fix (scene tokens swapped to hex). Six-phase plan at `docs/superpowers/plans/2026-05-07-frontend-pass-1.md`. Reference mockup at `design/variants/06-hybrid-3d.html`. Squash-merged via PR #36 (`02ea59f` on `main`).
- **Move-list stepper (Polish B) shipped: 2026-05-09.** End-to-end review-only stepper: pure helpers (`pairsFromMoves`, `viewedFen`, `stepPly`), `MoveList` + `MoveCell` components, RSC parallel fetch of `game_moves` → `initialMoves` prop, `viewedPly` state, drag-lock while scrubbed, auto-snap on `livePly` bump, wooden-thunk audio cue + Your-turn toast, keyboard arrows for prev/next/start/live, GSAP entry stagger, e2e coverage. Squash-merged via PR #38 → dev.
- **Brand pass 2 + scrub playback shipped: 2026-05-10.** Wordmark + Taylor SVG piece set rebuilt from Figma brand pass 2; editorial palette resynced with Figma tokens (dark bg lifted); in-game banner spans full grid; captured-piece strip aligned with player name. Move-list polish: CSS-driven entry tween (kills hydration delay), quadratic gap-decay stagger curve (gap 30ms → 5ms across N), optimistic move appears at piece-place time, fresh-cell tween synced with piece. Scrub playback: GSAP timeline walks board through intermediate FENs on click (per-move curve clamp(20, 200, 2000/N), bounded ~2s reveal); viewedPly walks alongside playback so highlight tracks board; drag disabled during playback. Header row adds lucide step icons + solid Play button (1s/move pacing, 200ms tween, oxblood active styling). Live + scrub piece easing unified on `cubic-bezier(0.4, 0, 0.2, 1)` at 200ms (chess.com / chessground convention). Squash-merged via PR #40 (`1300c3e` on `main`).
- **Polish A + Polish C shipped: 2026-05-10.** Polish A (draw-by-agreement): migration adds `games.draw_offered_by` column + four RPCs (offer / withdraw / accept / decline) + extends termination_reason CHECK for `draw_agreement` + `timeout`; make_move auto-clears the offer on every move. GameActions renders three contextual states (Accept/Decline banner, Withdraw banner, Offer Draw button); TerminalBanner adds "By agreement." + "By timeout." subtitles. Polish C (mobile + desktop layout): game-page outer capped at 768px (board 576 + gap 12 + list 180), board locked at 576px via `basis-[576px] shrink-0`, list snug 180px with `relative + absolute inset-0` pattern so long games don't inflate banner / pills cells. Move-list = single column (chess.com / lichess convention) with header non-scrolling; `scrollIntoView` scoped to desktop via `[data-desktop-list]` attr. Captured strip rebuilt with Tailwind v4 container queries (icons scale + overlap by *pill width*, not viewport). Site header: 820px breakpoint, fluid wordmark via clamp(), progressive nav hide, themed (rounded) toggle, server-resolved currentGameId. Mobile move list = auto-fill grid of pair-units, no scroll. Cross-cutting wins promoted to global memory: `tailwind-v4-container-queries.md` + `css-flex-grid-sizing-traps.md`. Squash-merged via PR #43 (`697c963` on `main`).
- Stable production alias: https://narrative-chess.vercel.app
- Two real users can sign up, create + join a game via shared URL, play with drag-or-click, see opponent's moves over realtime, end on checkmate / stalemate / resignation / abort / **timeout**. Observers (third+ authenticated viewer with the URL) can watch read-only. Header now shows display name → `/account`. Games directory updates live (no manual refresh) and toasts on game start. Landing page: hero → centered CTAs → three live stat panels.
- **Polish A/B/C** queued post-M1.5++: draw-by-agreement, move-list stepper (review-only), mobile/touch.

## Stack

- Next.js 16.2 + React 19 + TypeScript + Tailwind v4 + shadcn/ui + Zod
- Supabase (Postgres + Auth + Realtime), fresh project — v1 project paused after content export
- Hosting: Vercel Hobby with branch filter (`main` + `dev` only)
- Tooling: Bun (pinned via `package.json#packageManager`), Playwright for e2e, ESLint on, Husky/simple-git-hooks for pre-commit, GitHub Actions for CI

See [[decision-stack-nextjs-16]].

## Goals

- **M1**: untimed multiplayer chess. Two real users sign up, create + join a game, play with drag-and-drop, see opponent's moves live, end correctly on checkmate / stalemate / resign / abort / draw.
- **M1.5**: games directory + observer count + landing page + 3D hero + auth dialog.
- **M1.5++**: clocks (live + correspondence) + timeout sweep via Vercel Cron + strict reconnect policy.
- **M2+**: narrative layers (cities, characters, story beats) on top of a verified-stable chess core.

What success looks like for M1: two browsers, end-to-end smoke test green, no v1-style "Realtime fires but client sees nothing" trap.

## Constraints

- Solo dev (Taylor, semi-technical UX designer + Claude as collaborator)
- Free-tier infrastructure (Vercel Hobby, Supabase free tier)
- No budget for paid services in M1
- Time: open-ended; chess-first means narrative work is gated on M1 verification
- Platform: desktop-first for M1; mobile and a11y deferred

## Key decisions

### Foundation

- [[decision-three-way-info-split]] — `.claude/memory/` vs `wiki/` vs `docs/`
- [[decision-memory-injection-via-hook]] — auto-load memory via PreToolUse hook

### v2 design (2026-05-02 audit)

- [[decision-stack-nextjs-16]] — Next.js 16.2 + React 19 over Next.js 15
- [[decision-fresh-supabase-project]] — new project; v1 narrative JSON-archived
- [[decision-rpc-move-append]] — Postgres RPC with optimistic concurrency, not app-level orchestration
- [[decision-supabase-local-dev]] — hosted-first, Docker deferred
- [[decision-vercel-branch-filter]] — `main` + `dev` auto-deploy only
- [[decision-auth-email-password]] — email + password for M1

## Phases shipped (chronological)

| Phase | Step | Squash on `main` | What |
|---|---|---|---|
| 1 | A–E | (rolled into 2A scaffold) | Repo, CI, Husky, Vercel branch filter, conventions |
| 2 | F–H | `a92a465` | Vercel hookup, Supabase project + auth UI, profiles |
| 3 | I | `58ede0c` | Schema + RLS + Realtime publication + manual gate |
| 4 | J | `938961f` | `make_move` RPC + chess.js engine wrapper |
| 5 | K | `6178632` + `eaf38e0` + `9474e7a` | Board UI + realtime sync + observer mode + UX polish |
| 6 | L | `dd0bdb4` | Game end states + resign + abort + terminal banner |
| M1 | (ship) | `e81a3d9` | Production deploy via PR #12 |
| 7 | — | (in M1.5 squash) | Games directory + observer count (PR #13) |
| banner | — | (in M1.5 squash) | Terminal banner Back-to-games button (PR #15) |
| header | — | (in M1.5 squash) | Site-wide header nav (PR #16) |
| 8 | — | (in M1.5 squash) | Landing page + 3D hero + auth dialog (PR #19) |
| M1.5 | (ship) | `681f809` | Production deploy via PR #18 |
| polish | — | (in M1.5+ squash) | Hero3D WebGL context recovery (PR #20) |
| polish | — | (in M1.5+ squash) | AuthDialog onSuccess (PR #23) |
| polish | — | (in M1.5+ squash) | Theme toggle UI (PR #21) |
| polish | — | (in M1.5+ squash) | Dev-only fool's mate smoke (PR #22) |
| chore | — | (in M1.5+ squash) | Husky pre-commit shebang + LF gitattributes (PR #24) |
| M1.5+ | (ship) | `67243d5` | Production deploy via PR #25 |
| M1.5++ | (in M1.5++ squash) | — | Clocks (live + correspondence) + lazy/auto-claim/cron timeout + strict reconnect (PR #27) |
| polish | (in M1.5++ squash) | — | Clock SSR hydration fix (PR #28) |
| polish | (in M1.5++ squash) | — | Open-challenges null-side filter (PR #29) |
| polish | (in M1.5++ squash) | — | Account page + display-name in header (PR #30) |
| polish | (in M1.5++ squash) | — | Live games lobby + game-started toast (PR #31) |
| polish | (in M1.5++ squash) | — | Drop redundant Home nav link (PR #32) |
| polish | (in M1.5++ squash) | — | Home stat panels + vertical-stack layout + public_stats RPC (PR #33) |
| M1.5++ | (ship) | `5706e2b` | Production deploy via PR #34 |
| design pass | (ship) | `02ea59f` | Editorial-hybrid theme: Fraunces + Newsreader + JetBrains Mono fonts; ink + oxblood + cream palette (replaces shadcn-default teal); 3D hero rebuilt with walnut plinth, 5-piece cluster, GSAP entrance, theme-aware materials; new StageOverlay + StageCtas + LiveGameCard components; typography pass on game / auth / account / lobby pages; Three.js + oklch fix (scene tokens to hex). Production deploy via PR #36. |
| Polish B + brand pass 2 | (ship) | `1300c3e` | Move-list stepper: pure helpers + MoveList/MoveCell + RSC initialMoves + viewedPly + drag-lock + auto-snap + audio cue + Your-turn toast + keyboard arrows + GSAP stagger + e2e (PR #38). Brand pass 2: Wordmark + Taylor SVG piece set from Figma; editorial palette resynced; in-game banner spans grid; captured strip aligned with name. Move-list polish: CSS-driven entry tween, quadratic gap-decay stagger, optimistic move at piece-place, fresh-cell sync. Scrub playback: GSAP timeline walks intermediate FENs (curve clamp(20, 200, 2000/N), bounded ~2s); viewedPly walks alongside; drag disabled during playback. Header lucide step icons + solid Play (1s/move, 200ms tween, oxblood active). Piece easing unified on `cubic-bezier(0.4, 0, 0.2, 1)` at 200ms. Production deploy via PR #40. |

## Staged on `dev` (post-Polish-B+brand-pass-2, not yet on `main`)

(none, `dev` content-equal to `main` post-PR-#40 squash)

## M1.5++ ship details

- **Locked decisions:** configurable per-game time control, live + correspondence, chess.com 200ms lag credit, strict reconnect, 5 presets (Untimed / 5+0 / 10+0 / 15+10 / 1d-per-move), daily sweep + lazy detection primary, first-move timeout = abort, creator picks at create.
- **Migrations live on hosted Supabase** (`pgxqlyiyaehppkfeceuc`, eu-west-1) — applied via MCP `apply_migration` in 5 sequential calls. Existing M1+M1.5+ untimed games unaffected (NULL `time_control_type` skips clock math everywhere).
- **Supabase advisors clean** modulo intentional 0029 authenticated-callable SECURITY DEFINER on `make_move` (by design) + project-level leaked-password-protection.
- **CI status:** lint + typecheck green; Playwright skipped due to pre-existing CI workflow bug (`compgen "e2e/**/*.spec.ts"` glob misses top-level specs without `globstar`).

## Test accounts

- `taylor@redlamp.org` (`14e5b50b-3757-4ae7-8bcb-00aecdc57580`) — primary
- `alt+2@redlamp.org` (`ea16d37c-af00-4f2b-ad8c-bc0aa9019059`) — secondary
- Original `alt@redlamp.org` password lost; do not attempt to use.

## Branch state

- `main` — production (latest squash: brand-pass-2 + Polish-B `1300c3e`, 2026-05-10)
- `dev` — content-equal to `main` post-reconciliation merge `1b4f984`

## Open threads — post-M1.5++

- **CI workflow bug**: `compgen -G "e2e/**/*.spec.ts"` misses top-level specs without `shopt -s globstar`. All 15 e2e specs currently no-op in CI. One-line chore PR.
- **Polish A — draw-by-agreement** (offer / accept / decline flow): still queued.
- ~~**Polish B — move-list stepper**~~ — **closed by PR #38 + scrub-playback in PR #40** (shipped 2026-05-10).
- **Polish C — mobile / touch optimization**: still queued (after polish A settles).
- **Per-move clock display in MoveList**: deferred from Polish B v1.
- **Step N — privatize v1**: `gh repo edit redlamp/narrative-chess-v1 --visibility private --accept-visibility-change-consequences`. Pending until production smoke is satisfying. Always wait for explicit user go.
- **Both-sides fool's mate**: user asked, declined service-role server action route (security risk). Decision: stay with current per-side design; smoke is two-browser workflow.
- **Email confirmation**: currently OFF for ease of dev. Re-enable before broader release per `.claude/memory/domain/auth.md`. Originally proposed as Polish D this session, dropped — checklist in domain memory is bigger than "tiny" implies (SMTP, templates, callback route, reset flow, e2e). Defer until public-release ramp.
- **M2 — narrative layer prep** (cities, characters, story beats): post-polish. Will need brainstorm + spec.
- ~~**M1.5++ direction**~~ — **decided 2026-05-05** (clocks + timeout + reconnect; PR #27 open).
- ~~**AuthDialog success path**~~ — **closed by PR #23** (shipped to main in M1.5+).
- ~~**Theme toggle UI**~~ — **closed by PR #21** (next-themes ThemeProvider + Sun/Moon button in SiteHeader; shipped to main in M1.5+).
- ~~**Dev-only "fool's mate" debug button**~~ — **closed by PR #22** (per-side, dev/preview only via `VERCEL_ENV` gate; shipped to main in M1.5+).
- ~~**Husky pre-commit shebang**~~ — **closed by PR #24** (added `#!/bin/sh` + LF eol + `.gitattributes` pin; shipped to main in M1.5+).
- ~~**Game lobby** (`app/games/page.tsx` listing your active games + open challenges)~~ — **closed by Phase 7** (PR #13).
- ~~**Phase 8 landing page**~~ — **closed by PR #19** (3D hero + auth dialog, shipped in M1.5).

## Lessons captured

- [[lesson-realtime-auth-before-subscribe]] — postgres_changes silently denies events when `setAuth` races `channel.subscribe`. Always await session + setAuth before subscribing.
- [[lesson-dev-main-merge-after-squash]] — squash-merging each feat-branch into `dev` then `dev` → `main` causes content-equal-but-SHA-divergent histories. Expect add/add conflicts on every promotion; resolve with `git checkout --ours` since dev is the superset. Confirmed at both M1 and M1.5 ships.
- [[lesson-webgl-strict-mode-context-loss]] — R3F + Next dev double-mount disposes the WebGLRenderer's GL context. Disabled `reactStrictMode` in `next.config.ts` + added `webglcontextlost`/`webglcontextrestored` recovery in `Hero3D.tsx` `onCreated`.

## Related

- [[narrative-chess-v1]] — predecessor
- [[mocs/architecture]]
- [[mocs/decisions]]
- [[mocs/game-design]]
- `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` — full design spec (source of truth)
- `docs/V2_PLAN.md` — original plan (frozen, historical)
