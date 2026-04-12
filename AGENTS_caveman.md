# AGENTS.md

## Project Summary

Narrative Chess = web chess game with generative narrative layer.

Priority order:
1. chess clarity + correctness
2. lightweight narrative value
3. city-context presentation
4. richer map/3D later

Not full urban simulation. Don't overbuild for current milestone.

## Current Priorities

- stable local chess prototype first
- minimal narrative event log early
- 2D board before Three.js
- city data open-data-seeded + editor-reviewed, not generated on fly
- first playable character schema lightweight

## Repository Boundaries

- `apps/web` — app UI, route composition, user-facing panels
- `packages/game-core` — chess rules, legal move validation, game-state helpers
- `packages/content-schema` — shared types, enums, validation schemas
- `packages/narrative-engine` — narrative event generation, template selection, memory hooks
- `content/` — structured city, district, faction, narrative content
- `docs/` — planning, notes, supporting docs

Don't create new packages without clear ownership boundary or reuse case.

## Milestone Discipline

Optimize for current milestone.

### Milestone 0
Focus:
- repo structure
- TypeScript setup
- linting, formatting, testing
- baseline React app
- shared schemas
- workflow docs

Don't overbuild gameplay or rendering.

### Milestone 1
Focus:
- legal local chess
- move history
- undo
- clear board UI
- minimal narrative hooks
- optional low-skill legal-move opponent only if straightforward

Non-goals:
- multiplayer
- 3D board
- authored city research
- advanced AI strength
- comic/vignette systems

### Milestone 2
Focus:
- Edinburgh board mapping
- district metadata
- board + city data alignment
- simple map-mode support

Don't attempt full geospatial fidelity.

## Agent Rules

- prefer narrow, bounded tasks
- don't refactor unrelated files
- don't change shared schemas without explicit note in output
- don't make architecture-wide decisions implicitly
- favor readable, maintainable code over clever abstractions
- preserve separation between gameplay logic, content, presentation
- output brief integration note for non-trivial changes

## File Ownership Guidance

### `apps/web`
Allowed:
- board UI
- panels
- local app shell
- route composition
- interaction states tied to UI

Avoid:
- embedding chess rules directly in components
- embedding large narrative template logic in components

### `packages/game-core`
Allowed:
- chess.js integration or equivalent
- legal move validation
- turn sequencing
- move history transformations
- game-state helpers

Avoid:
- UI concerns
- content authoring
- narrative prose templates

### `packages/content-schema`
Allowed:
- TypeScript types
- Zod schemas
- enums
- validation helpers

Avoid:
- runtime business logic
- UI logic

### `packages/narrative-engine`
Allowed:
- move-to-event mapping
- narrative template selection
- event text assembly
- memory hook recording

Avoid:
- chess legality logic
- UI component rendering

### `content/`
Allowed:
- JSON, YAML, markdown, other structured content assets
- city data
- district data
- templates
- reviewed narrative content

Avoid:
- runtime logic
- hidden computed behavior inside content files

## Character + Content Rules

First playable version: character generation stays lightweight.

Use:
- name
- role
- district of origin
- faction
- curated traits
- curated verbs
- one-line description

Avoid broad procedural assignment of sensitive demographic fields (religion, sexuality, ethnicity) in early milestones.

Content generation:
- separate appearance/style from moral framing
- don't make immutable identity traits cause of good/evil alignment
- allow fields to be unknown, omitted, or deferred
- allow culturally progressive + diverse representation
- allow antagonistic/harmful characters where useful — don't frame traits as representative of groups or neighborhoods
- prefer broad plausibility + editorial restraint over false specificity

## Provenance + Review Rules

Generated content supports:
- `generation_source`
- `generation_model`
- `content_status`
- `review_status`
- `review_notes`
- `last_reviewed_at`

Values:
- `content_status`: `empty`, `procedural`, `authored`
- `review_status`: `empty`, `needs review`, `reviewed`, `approved`

## Quality Bar

- add tests for logic changes where practical
- avoid hidden magic values
- keep types explicit
- keep components small where possible
- document assumptions only where useful
- keep narrative templates + content data easy to inspect + edit
- prefer simple contracts over premature abstraction

## Integration Rules

Before changes:
1. identify milestone
2. identify target package or folder
3. identify contract relied on

If contract unclear:
- define/update interface first
- don't silently invent broad architecture across packages

If parallel work may conflict:
- prefer mock data or local interfaces first
- minimize edits to shared files
- leave clear TODO rather than speculative architectural changes

## Output Expectations for Agents

For meaningful tasks:
- summary of what changed
- files changed
- assumptions made
- follow-up integration notes
- schema changes called out explicitly

## Preferred Build Sequence

1. local playable chess
2. minimal narrative event log
3. Edinburgh board mapping
4. character generation
5. stronger narrative memory + templates
6. optional 3D presentation
7. multiplayer later

## Default Decision Heuristics

When unsure:
- prefer chess readability over visual flair
- prefer simpler data models over ambitious ones
- prefer reviewed content over fully procedural content
- prefer editability over automation
- prefer milestone progress over speculative future-proofing
