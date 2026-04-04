# AGENTS.md

## Project Summary

Narrative Chess is a web-based chess game with a generative narrative layer.

The project priority order is:
1. chess clarity and correctness
2. lightweight narrative value
3. city-context presentation
4. richer map or 3D presentation later

This is not a full urban simulation. Do not overbuild systems that are not needed for the current milestone.

## Current Priorities

- build a stable local chess prototype first
- include a minimal narrative event log early
- use a 2D board before introducing Three.js board rendering
- keep city data open-data-seeded and editor-reviewed rather than generated on the fly
- keep the first playable character schema lightweight

## Repository Boundaries

- `apps/web` owns app UI, route-level composition, and user-facing panels
- `packages/game-core` owns chess rules integration, legal move validation, and game-state helpers
- `packages/content-schema` owns shared types, enums, and validation schemas
- `packages/narrative-engine` owns narrative event generation, template selection, and memory hooks
- `content/` owns structured city, district, faction, and narrative content
- `docs/` owns planning, notes, and supporting documentation

Do not create new packages unless there is a clear ownership boundary or reuse case.

## Milestone Discipline

Always optimize for the current milestone.

### Milestone 0
Focus on:
- repo structure
- TypeScript setup
- linting, formatting, testing
- baseline React app
- shared schemas
- workflow docs

Do not overbuild gameplay or rendering.

### Milestone 1
Focus on:
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
- comic or vignette systems

### Milestone 2
Focus on:
- Edinburgh board mapping
- district metadata
- board and city data alignment
- simple map-mode support

Do not attempt full geospatial fidelity.

## Agent Rules

- prefer narrow, bounded tasks
- do not refactor unrelated files
- do not change shared schemas without explicit note in your output
- do not make architecture-wide decisions implicitly
- favor readable, maintainable code over clever abstractions
- preserve clear separation between gameplay logic, content, and presentation
- output a brief integration note for non-trivial changes

## File Ownership Guidance

### `apps/web`
Allowed:
- board UI
- panels
- local app shell
- route composition
- interaction states tied to UI

Avoid:
- embedding chess rules logic directly in components
- embedding large narrative template logic directly in components

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
- JSON, YAML, markdown, or other structured content assets
- city data
- district data
- templates
- reviewed narrative content

Avoid:
- runtime logic
- hidden computed behavior inside content files

## Character and Content Rules

For the first playable version, character generation should stay lightweight.

Use:
- name
- role
- district of origin
- faction
- curated traits
- curated verbs
- one-line description

Avoid broad procedural assignment of sensitive demographic fields such as religion, sexuality, or ethnicity as explicit structured data in early milestones.

When generating content:
- separate appearance or style from moral framing
- do not make immutable identity traits the cause of good or evil alignment
- allow some fields to be unknown, omitted, or deferred
- allow culturally progressive and diverse representation
- allow antagonistic or harmful characters when useful to narrative, but do not frame those traits as representative of groups or neighborhoods
- prefer broad plausibility and editorial restraint over false specificity

## Provenance and Review Rules

Where applicable, generated content should support:
- `generation_source`
- `generation_model`
- `content_status`
- `review_status`
- `review_notes`
- `last_reviewed_at`

Use these values consistently:
- `content_status`: `empty`, `procedural`, `authored`
- `review_status`: `empty`, `needs review`, `reviewed`, `approved`

## Quality Bar

- add tests for logic changes where practical
- avoid hidden magic values
- keep types explicit
- keep components small where possible
- document assumptions only where useful
- keep narrative templates and content data easy to inspect and edit
- prefer simple contracts over premature abstraction

## Integration Rules

Before making changes:
1. identify the milestone
2. identify the target package or folder
3. identify the contract you are relying on

If a contract is unclear:
- define or update the interface first
- do not silently invent broad architecture across multiple packages

If parallel work may conflict:
- prefer mock data or local interfaces first
- minimize edits to shared files
- leave a clear TODO rather than making speculative architectural changes

## Output Expectations for Agents

For meaningful tasks, provide:
- summary of what changed
- files changed
- assumptions made
- follow-up integration notes
- any schema changes called out explicitly

## Preferred Build Sequence

1. local playable chess
2. minimal narrative event log
3. Edinburgh board mapping
4. character generation
5. stronger narrative memory and templates
6. optional 3D presentation
7. multiplayer later

## Default Decision Heuristics

When unsure:
- prefer chess readability over visual flair
- prefer simpler data models over ambitious ones
- prefer reviewed content over fully procedural content
- prefer editability over automation
- prefer milestone progress over speculative future-proofing

