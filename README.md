# Narrative Chess

Narrative Chess is a web-based chess game with a generative narrative layer.

The board is a city. The pieces are people. Each move contributes to an emergent social narrative built on top of playable chess.

## Current Project Status

This repository is being set up around an early prototype focused on:
- legal local chess
- clear board UI
- minimal narrative event logging
- a lightweight path toward city-based boards

The first major target is a clean local chess vertical slice, followed by an Edinburgh-based board prototype.

## Product Direction

High-level product planning lives in:
- `docs/prd.md`

Repo operating rules for coding agents live in:
- `AGENTS.md`

## Planned Repository Structure

```text
apps/
  web/
packages/
  game-core/
  content-schema/
  narrative-engine/
content/
  cities/
  templates/
docs/
AGENTS.md
README.md
```

## Early Milestones

### Milestone 0 — Project Foundation
- repo structure
- TypeScript setup
- linting, formatting, and tests
- baseline React app
- shared schemas
- basic docs

### Milestone 1 — Core Chess Vertical Slice
- legal chess rules
- move history
- undo
- board UI
- minimal narrative event log
- optional low-skill legal-move opponent

### Milestone 2 — City Board Prototype
- Edinburgh board mapping
- district metadata
- board and city data alignment
- simple map-mode support

## Default Tech Direction

- frontend: React + TypeScript
- UI: shadcn/ui
- game logic: chess.js or equivalent
- state: Zustand or Redux Toolkit
- schemas: TypeScript + Zod
- backend later: Supabase or PostgreSQL-backed service
- 3D later: Three.js, only after the 2D prototype proves out

## Development Principles

- chess clarity comes first
- narrative should enrich, not obscure, gameplay
- content should stay editable and reviewable
- avoid overbuilding systems before the current milestone is proven
- prefer small, testable contracts between packages

## Suggested Local Commands

These are the intended commands once the repo is bootstrapped:

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

Update this section once the actual tooling is in place.

## Definition of Done for the First Playable Slice

The first playable slice is considered successful when:
- a player can complete a full local game
- all legal moves validate correctly
- check, checkmate, and stalemate are surfaced in the UI
- undo restores the exact prior game state
- a minimal narrative event is generated for every move
- if the AI opponent is included, it completes legal turns reliably at a hobbyist-friendly level

## Notes for Codex / Claude Code

Before starting work:
1. read `AGENTS.md`
2. read `docs/prd.md`
3. confirm the current milestone
4. work within a bounded package or folder
5. call out schema changes explicitly

## Near-Term Setup Tasks

- create the monorepo structure
- bootstrap the React app
- add shared schema package
- add chess rules integration
- add initial board UI
- add docs/prd.md from the working PRD
- copy the repo-ready `AGENTS.md` into the repo root

