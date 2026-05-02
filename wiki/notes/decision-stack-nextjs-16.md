# Decision — Stack: Next.js 16.2 + React 19

**Date:** 2026-05-02
**Status:** Adopted

## Context

`docs/V2_PLAN.md` originally locked Next.js 15. Audit on 2026-05-02 found Next.js 16.2 is current (released 2026-03-18). 16.2 ships agent-ready `create-next-app`, browser log forwarding for AI workflows, Server Fast Refresh (~87% faster startup vs 16.1), and 200+ Turbopack fixes — directly relevant to the project's "AI-friendly repo from day one" goal.

Counter-consideration: Claude's training cutoff is Jan 2026; Next.js 16.2 post-dates that by ~6 weeks of API surface.

## Options considered

1. Stay on Next.js 15.x (LTS through Oct 2026, fully within Claude's training)
2. Use Next.js 16.2 stable
3. Use latest canary (16.3+)

## Choice

**Next.js 16.2 stable.** React 19. TypeScript. Tailwind v4. shadcn/ui. Supabase JS + SSR. chess.js. Zod.

## Why

- Agent-ready features in 16.2 are specifically built to reduce AI-collaboration friction — exactly the project goal
- App Router + Server Actions (the patterns 95% of M1 uses) have been stable since Next 13.4 (May 2023), well within Claude's training
- Risk of post-training API drift is mitigated by:
  - WebFetch + WebSearch available for current docs
  - CLAUDE.md mandate: "verify Next.js syntax against current docs before introducing patterns not already in repo"
  - Most novel surface area in 16.x is opt-in
- LTS path (Next 15) saves training-data risk but loses the agent improvements that motivated upgrading the stack at all

## Risks / follow-ups

- If a 16.x-specific API shows up and Claude fabricates a 15.x-style call, error surfaces at typecheck or build. Acceptable failure mode.
- Re-evaluate at Next.js 17.x release: same audit, same options.

## See also

- [[mocs/decisions]]
- [[mocs/architecture]]
- `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` §4
- Next.js 16.2 blog: https://nextjs.org/blog/next-16-2
