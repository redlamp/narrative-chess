---
tags:
  - domain/chess-engine
  - domain/narrative
  - origin/external-research
---

# 15 Key Chess Opening Principles

**Type:** article
**Author / Channel:** GM Igor Smirnov — Remote Chess Academy (chess-teacher.com)
**Published:** 2024-06-19
**Captured:** 2026-05-03
**Source:** https://chess-teacher.com/opening-principles/

## Summary

Principle-based opening guide aimed at improving players who'd rather learn the *why* than memorize lines. Smirnov walks through 15 universal rules covering centre control, piece development order, king safety, and reactive ideas like counterattacking a premature assault. Each rule is paired with a short tactical example. Companion video lesson and a broader course ("Level Up Your Chess") sit alongside the post.

## Key points

- Occupy the centre with pawns; control it with pieces once pawns are committed.
- Develop minor pieces toward the centre — knights before bishops; knights belong on 3rd/6th rank.
- Castle within 5–10 moves; connect rooks after.
- Don't move the same piece twice in the opening, don't bring the queen out early, don't push flank pawns without reason.
- Avoid trading bishops for knights without compensation.
- Don't open the centre when behind in development; counterattack the centre when opponent attacks prematurely.
- Place the queen on a central 2nd-rank square once development is underway.

## Why it matters here

Useful canon for the narrative engine's evaluation of player decisions. If V2 wants to *narrate* the quality of an opening (praise good development, flag premature queen sorties), these 15 rules are a compact rubric to encode as heuristics — each maps to detectable board states (piece-on-square checks, move counts since rule violation, castling status). Likely feeds into `lib/chess/engine.ts` wrappers or a separate `lib/narrative/opening-heuristics.ts` later.

## Related

- [[mocs/research]]
- [[mocs/game-design]]
