# AGENTS.md

## PRD Reference

Full product context, milestone status, architecture, and agent workstreams: [`docs/PRD.md`](docs/PRD.md). Read it before non-trivial work.

## Project Summary

Narrative Chess = web chess with narrative layer grounded in city geography, district metadata, character framing.

Priority order:
1. chess clarity + correctness
2. lightweight narrative value
3. city-context presentation
4. richer spatial/visual presentation later

Not a full urban simulation. Do not overbuild systems not needed for current milestone.

## Current State

Beyond prototype. Includes: playable local chess, study replay, city-aware board (Edinburgh), structured content editors, shared layout tooling, design token system, GitHub Pages deployment, optional Supabase auth/cloud saves, and early multiplayer turn sync. Still local-first: browser-local state + optional file saves + checked-in content remain core.

Six pages: Play, Cities, Classics, Roles, Research, Design.

## Current Priorities

Active target: Milestone 2 completion + Milestone 6 durability. Don't widen scope.

- stabilize Play + Cities as dependable surfaces
- align authored data with gameplay
- resolve data-source ambiguity (biggest current problem)
- consolidate before expanding

## Repository Boundaries

- `apps/web` — UI, panels, page composition, editor flows, browser persistence
- `packages/game-core` — chess.js integration, legal move validation, game-state helpers
- `packages/content-schema` — shared Zod schemas + TypeScript contracts
- `packages/narrative-engine` — narrative event generation, template selection, memory hooks
- `content/` — structured city, district, narrative content (checked-in JSON)
- `docs/` — planning, PRD, supporting documentation

Do not create new packages unless clear ownership boundary or reuse case.

## Milestone Discipline

Always optimize for current milestone. See `docs/PRD.md` Section 6 for full status.

### Milestone 0 — Foundation ✅ Complete
### Milestone 1 — Core Chess ✅ Complete
### Milestone 2 — City Board 🔄 In Progress (primary target)
### Milestone 3 — Character Generation 🔄 In Progress
### Milestone 4 — Narrative Event Layer 🔄 In Progress
### Milestone 5 — Visual Identity/3D ⏳ Not Started
### Milestone 6 — Durable Content + Save 🔄 In Progress (parallel target)
### Milestone 7 — Multiplayer 🔄 In Progress
### Milestone 8 — Story Artifact Output ⏳ Not Started

## Agent Rules

- prefer narrow, bounded tasks
- do not refactor unrelated files
- do not change shared schemas without explicit note in output
- do not make architecture-wide decisions implicitly
- favor readable, maintainable code over clever abstractions
- preserve clear separation between gameplay logic, content, presentation
- output brief integration note for non-trivial changes

## File Ownership Guidance

### `apps/web`
Allowed: board UI, panels, local app shell, route composition, interaction states tied to UI
Avoid: embedding chess rules logic directly in components, embedding large narrative template logic directly in components

### `packages/game-core`
Allowed: chess.js integration, legal move validation, turn sequencing, move history, game-state helpers
Avoid: UI concerns, content authoring, narrative prose templates

### `packages/content-schema`
Allowed: TypeScript types, Zod schemas, enums, validation helpers
Avoid: runtime business logic, UI logic

### `packages/narrative-engine`
Allowed: move-to-event mapping, narrative template selection, event text assembly, memory hook recording
Avoid: chess legality logic, UI component rendering

### `content/`
Allowed: JSON/YAML/markdown content assets, city data, district data, templates, reviewed narrative content
Avoid: runtime logic, hidden computed behavior inside content files

## Character and Content Rules

Character generation stays lightweight. Use: name, role, district of origin, faction, curated traits, curated verbs, one-line description.

Avoid broad procedural assignment of sensitive demographic fields (religion, sexuality, ethnicity) as explicit structured data in early milestones.

When generating content:
- separate appearance/style from moral framing
- do not make immutable identity traits cause of good/evil alignment
- allow fields to be unknown, omitted, deferred
- allow culturally progressive + diverse representation
- allow antagonistic characters when useful to narrative, but don't frame traits as representative of groups/neighborhoods
- prefer broad plausibility + editorial restraint over false specificity

## Provenance and Review Rules

Where applicable, generated content should support:
- `generation_source`, `generation_model`
- `content_status`: `empty`, `procedural`, `authored`
- `review_status`: `empty`, `needs review`, `reviewed`, `approved`
- `review_notes`, `last_reviewed_at`

## Quality Bar

- add tests for logic changes where practical
- avoid hidden magic values
- keep types explicit
- keep components small where possible
- document assumptions only where useful
- keep narrative templates + content data easy to inspect and edit
- prefer simple contracts over premature abstraction

## Integration Rules

Before making changes:
1. identify milestone
2. identify target package/folder
3. identify contract you're relying on

If contract unclear: define/update interface first. Don't silently invent broad architecture across packages.

If parallel work may conflict: prefer mock data or local interfaces first, minimize shared file edits, leave clear TODO over speculative architectural changes.

## Output Expectations for Agents

For meaningful tasks, provide:
- summary of what changed
- files changed
- assumptions made
- follow-up integration notes
- schema changes called out explicitly

## Default Decision Heuristics

When unsure:
- prefer chess readability over visual flair
- prefer simpler data models over ambitious ones
- prefer reviewed content over fully procedural content
- prefer editability over automation
- prefer milestone progress over speculative future-proofing
