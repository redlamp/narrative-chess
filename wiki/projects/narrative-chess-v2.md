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
- Phase: design spec drafted (`docs/superpowers/specs/2026-05-02-v2-foundation-design.md`)
- Repo state: local `dev` + `main` at `d28c342`, not yet pushed to GitHub remote
- Next concrete step: create `redlamp/narrative-chess` on GitHub + push (Step C in spec)

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

## Open threads

- Push v1's last commit (`58c6eca`) to `origin/main` before any other action
- Create `redlamp/narrative-chess` GitHub repo (Step C in spec)
- Run `bun create next-app` scaffold inside existing v2 folder (Step D)
- Wire repo conventions: `vercel.json`, CI, branch protection, PR template, `.mcp.json`, AGENTS.md (Step E)
- Vercel hookup with branch filter (Step F)
- Export v1 narrative content to `content/v1-narrative-archive/` (Step G)
- Create fresh Supabase project + auth shell (Step H)
- Two-browser RLS+Realtime sanity gate before any UI work (Step I — critical)
- Move RPC, board UI, end-state detection, e2e (Steps J-M)
- Privatize v1 repo after M1 ships (Step N)

## Related

- [[narrative-chess-v1]] — predecessor
- [[mocs/architecture]]
- [[mocs/decisions]]
- [[mocs/game-design]]
- `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` — full design spec (source of truth)
- `docs/V2_PLAN.md` — original plan (frozen, historical)
