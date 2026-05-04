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
- Stable production alias: https://narrative-chess.vercel.app
- Two real users can sign up, create + join a game via shared URL, play with drag-or-click, see opponent's moves over realtime, end on checkmate / stalemate / resignation / abort. Observers (third+ authenticated viewer with the URL) can watch read-only. New: top-level header nav, games directory at `/games`, terminal banner "Back to games" button on game-end, marketing landing page with 3D hero + auth dialog.
- **`dev` content-equal to `main`** post-reconciliation merge `b14e2d6` + one docs-only commit `0206d50` (switch feat → dev merges to `--no-ff`).
- **Next gate:** decide M1.5+ vs M2 direction. No code currently staged for the next milestone.

## Stack

- Next.js 16.2 + React 19 + TypeScript + Tailwind v4 + shadcn/ui + Zod
- Supabase (Postgres + Auth + Realtime), fresh project — v1 project paused after content export
- Hosting: Vercel Hobby with branch filter (`main` + `dev` only)
- Tooling: Bun (pinned via `package.json#packageManager`), Playwright for e2e, ESLint on, Husky/simple-git-hooks for pre-commit, GitHub Actions for CI

See [[decision-stack-nextjs-16]].

## Goals

- **M1**: untimed multiplayer chess. Two real users sign up, create + join a game, play with drag-and-drop, see opponent's moves live, end correctly on checkmate / stalemate / resign / abort / draw.
- **M1.5**: clocks (live + move-deadline), timeout sweep via Vercel Cron, reconnect policy.
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

## Staged on `dev` (post-M1.5, not yet on `main`)

| What | Merge commit on `dev` | Status |
|---|---|---|
| Switch feat → dev merge to `--no-ff` (preserves branch viz) | `0206d50` (docs, direct push) | direct push to dev |
| Hero3D WebGL context recovery (PR #20) | `362ccac` | merged with `--no-ff` |
| AuthDialog onSuccess (PR #23) | `47bd772` | merged with `--no-ff` |
| Theme toggle UI (PR #21) | `2f31936` | merged with `--no-ff` |
| Dev-only fool's mate smoke button (PR #22) | `f3df4f8` | merged with `--no-ff` |

## Open threads — post-M1.5

- **Promote `dev` → `main`**: four polish PRs above ready to ship. Use `gh pr merge <N> --squash` per main's linear-history rule. Expect post-squash divergence; reconcile with `git merge origin/main` on dev, take `--ours` (lesson `[[lesson-dev-main-merge-after-squash]]`).
- **Step N — privatize v1**: `gh repo edit redlamp/narrative-chess-v1 --visibility private --accept-visibility-change-consequences`. Pending until production smoke is satisfying. Always wait for explicit user go.
- **Decide next milestone**: M1.5+ (clocks + timeout sweep via Vercel Cron + reconnect policy) or M2 (narrative layer prep — cities, characters, story beats). Both need brainstorm + spec before code.
- **Husky pre-commit shebang**: `.husky/pre-commit` has no shebang + CRLF endings; agent worktrees on Windows MINGW can't exec it directly, forcing `--no-verify`. One-line chore PR: add `#!/bin/sh` + LF endings. Worth doing before next subagent dispatch.
- **Both-sides fool's mate**: user asked, declined service-role server action route (security risk). Decision: stay with current per-side design; smoke is two-browser workflow.
- **Mobile / touch optimization**: deferred from M1 (desktop-first). Revisit when a real mobile user shows up.
- **Move list / scrollable history with click-to-rewind**: deferred from phase 6. Nice-to-have polish.
- **Draw-by-agreement** (offer / accept / decline flow): deferred from phase 6. Real chess UX requires it; pair with clocks in M1.5+.
- **Email confirmation**: currently OFF for ease of dev. Re-enable before broader release per `.claude/memory/domain/auth.md`.
- ~~**AuthDialog success path**~~ — **closed by PR #23**.
- ~~**Theme toggle UI**~~ — **closed by PR #21** (next-themes ThemeProvider + Sun/Moon button in SiteHeader).
- ~~**Dev-only "fool's mate" debug button**~~ — **closed by PR #22** (per-side, dev/preview only via `VERCEL_ENV` gate).
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
