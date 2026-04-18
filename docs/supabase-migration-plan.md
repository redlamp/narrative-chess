# Supabase Migration Plan

Last updated: April 18, 2026
Status: Proposed implementation plan
Primary milestone target: Milestone 2 completion + Milestone 6 durability

## Purpose

This document defines a pragmatic backend plan for Narrative Chess using Supabase.

It is written for agents working on current priorities:

- remove save-state ambiguity
- make Cities and character/content tools more durable
- preserve chess correctness and current local-first momentum
- avoid unnecessary hosting or architecture changes

This plan assumes:

- frontend hosting remains on GitHub Pages for now
- Supabase is introduced as the backend system of record
- browser persistence remains, but only as cache / local draft support
- file export remains available, but becomes backup/import tooling instead of canonical storage

## Why Supabase Now

Current repo pain is not deployment. It is persistence fragmentation.

Today the app uses a mix of:

- bundled repo content
- `localStorage`
- IndexedDB for File System Access directory handles
- optional filesystem saves

The PRD identifies the core problem clearly: local edits, file saves, repo-tracked content, and deployed state can drift silently.

Supabase helps because it gives the project:

- a canonical Postgres data source
- structured draft vs published records
- auth if/when editor accounts are needed
- storage for exports or future media assets
- a clean future path to collaboration, revision history, and multiplayer support

Vercel is not required for this phase. It can be reconsidered later if deployment workflow becomes a bottleneck.

## Scope

### In scope

- define canonical data ownership rules
- move content entities from browser/file ambiguity to DB-backed persistence
- support explicit draft and published states
- support revision history at the record/version level
- keep existing local editing flows working during migration
- provide an incremental rollout path instead of a big-bang rewrite

### Out of scope

- multiplayer
- realtime collaboration
- broad CMS/editor redesign
- hosting migration away from GitHub Pages
- replacing all local persistence immediately
- major schema redesign across packages without a narrow need

## Decision Summary

Use Supabase as the canonical backend for authored content and durable saved data.

Keep GitHub Pages as the frontend host.

Use DreamHost only for DNS if a custom subdomain is desired, for example `narrative.example.com` pointing to GitHub Pages.

## Canonical Ownership Rules

These rules should guide all implementation work.

### Canonical sources by category

- App settings and purely personal workspace preferences:
  - stay local-only for now
  - examples: panel layout, view mode, piece-style experiments unless explicitly promoted
- Authored shared content:
  - move to Supabase canonical storage
  - examples: cities, districts, role catalog, character records, reference/classic game library
- User-save gameplay artifacts:
  - move to Supabase when signed in
  - may remain local-only for anonymous users during transition
- Repo checked-in `content/` files:
  - become seed / export / backup material
  - no longer treated as the runtime system of record once the relevant entity is migrated
- File System Access saves:
  - become import/export and local backup tools
  - not canonical

### Draft and publish semantics

For migrated content entities, use these states:

- `local_draft`
  - unsynced browser state only
- `remote_draft`
  - saved to Supabase, not live/published
- `published`
  - current public/runtime version used by Play and Cities

Agents should not conflate "saved" with "published". Saving a draft must not silently change the live gameplay dataset.

## Current Save Model to Replace

Relevant current code paths:

- [apps/web/src/cityReviewState.ts](/abs/path/c:/workspace/narrative-chess/apps/web/src/cityReviewState.ts:1)
- [apps/web/src/fileSystemAccess.ts](/abs/path/c:/workspace/narrative-chess/apps/web/src/fileSystemAccess.ts:1)
- [apps/web/src/savedMatches.ts](/abs/path/c:/workspace/narrative-chess/apps/web/src/savedMatches.ts:1)

Important current behavior:

- city boards already model a local distinction between `published`, `saved`, and `draft`
- local "saved baseline" is still browser/file based, not backend canonical
- saved matches are fully localStorage-based
- role catalog and classic games still rely heavily on browser and filesystem workflows

This is useful because the UI language already exists. The migration should preserve that mental model while changing where truth lives.

## Rollout Order

Do not migrate everything at once.

### Phase 0: Contracts and terminology

Goal:
- define shared persistence language before backend writes are introduced

Deliverables:

- document canonical vs local draft rules in code and docs
- define per-entity sync status vocabulary
- define which surfaces read `published` data and which surfaces edit `draft` data

Recommended implementation notes:

- add small frontend-facing types instead of broad architecture changes
- prefer a `source` or `syncStatus` field over ad hoc booleans

### Phase 1: Cities first

Goal:
- solve the most visible and highest-value persistence problem first

Why first:

- Cities is already the strongest authored surface
- the PRD already highlights city-board canonicality as partially solved
- Play depends on city data integrity

Deliverables:

- Supabase tables for city boards and version history
- ability to load published city data into Play
- ability to edit a remote draft in Cities
- explicit publish action
- explicit reset-to-published action

UI behavior target:

- Cities page edits a draft
- Play defaults to published city data
- optional toggle later to preview a selected draft in Play for editor testing

### Phase 2: Role catalog and character foundations

Goal:
- support richer authored content for roles and future character overrides

Deliverables:

- migrate role catalog persistence to Supabase
- define authored character override path without overbuilding generator logic
- preserve current lightweight character model from AGENTS.md

Notes:

- character generation should stay lightweight
- authored overrides should be narrow: name, role, district, faction, traits, verbs, summary, status metadata

### Phase 3: Reference/classic games and saved matches

Goal:
- stabilize the remaining save-heavy surfaces

Deliverables:

- remote persistence for reference games library
- remote persistence for signed-in saved matches
- anonymous fallback can remain local during the first pass

Notes:

- saved matches should not block on auth if that hurts usability
- a dual-path model is acceptable at first:
  - signed-in users get remote saves
  - anonymous users keep local saves with optional import/migration later

### Phase 4: Cleanup and deprecation

Goal:
- remove old ambiguity once remote persistence is stable

Deliverables:

- de-emphasize "save to connected folder" as primary workflow
- keep export/import for backup and editorial review
- remove legacy assumptions that bundled JSON is the default live source for migrated entities

## Recommended Data Model

The exact schema should be kept narrow and explicit.

### Core tables

#### `cities`

Purpose:
- stable identity and routing for a city

Suggested fields:

- `id`
- `slug`
- `name`
- `country`
- `created_at`
- `updated_at`

#### `city_versions`

Purpose:
- immutable record of draft and published city board versions

Suggested fields:

- `id`
- `city_id`
- `version_number`
- `status` with values such as `draft`, `published`, `archived`
- `board_payload` as JSONB
- `created_by`
- `created_at`
- `published_at`
- `notes`

Recommended rule:

- never overwrite a published payload in place
- publish by creating or promoting a versioned record

#### `roles`

Purpose:
- stable identity for role entries

Suggested fields:

- `id`
- `piece_kind`
- `name`
- `created_at`
- `updated_at`

#### `role_versions`

Purpose:
- draft/published role content history

Suggested fields:

- `id`
- `role_id`
- `status`
- `payload` as JSONB
- `created_by`
- `created_at`
- `published_at`

#### `characters`

Purpose:
- authored override records, not full procedural identity generation

Suggested fields:

- `id`
- `city_id`
- `piece_key` or equivalent gameplay anchor
- `status`
- `payload` as JSONB
- `created_by`
- `created_at`
- `updated_at`

#### `reference_games`

Purpose:
- curated study library identity

Suggested fields:

- `id`
- `slug`
- `title`
- `created_at`
- `updated_at`

#### `reference_game_versions`

Purpose:
- versioned editorial content for studies

Suggested fields:

- `id`
- `reference_game_id`
- `status`
- `payload` as JSONB
- `created_by`
- `created_at`
- `published_at`

#### `saved_matches`

Purpose:
- durable user saves

Suggested fields:

- `id`
- `user_id`
- `name`
- `snapshot_payload` as JSONB
- `move_count`
- `created_at`
- `updated_at`

### Why version tables instead of in-place edits

This plan favors version tables because the product needs:

- explicit draft vs published distinction
- future revision history
- safer editorial publish flows
- easier rollback

This is more aligned with the PRD than a single mutable table per entity.

## Schema Strategy

### Preferred approach

- keep shared runtime validation in `packages/content-schema`
- use JSONB payloads initially for faster migration
- validate payloads at the application edge with existing Zod schemas
- normalize into more relational columns later only when query needs justify it

This avoids a premature schema explosion while still getting durable storage and clear versioning.

### Important constraint

Do not change shared schemas casually.

If an agent updates `packages/content-schema`, they must call it out explicitly and explain why the frontend and backend contracts required it.

## Auth Strategy

### Initial recommendation

- enable Supabase Auth
- keep access narrow at first
- start with authenticated editor access only

Suggested initial model:

- anonymous public reads for published content if needed
- authenticated writes for editor tools
- saved matches remote-only for authenticated users

This keeps the public Play surface simple while protecting authored content.

### Not needed yet

- social login
- fine-grained team org roles
- public user accounts

Email magic link or a small editor-only auth setup is enough for the first pass.

## API Strategy

### Preferred first implementation

- frontend talks directly to Supabase for simple reads and writes
- use Row Level Security policies for access control
- avoid introducing a separate custom API layer unless a workflow truly needs it

### When to add Edge Functions

Only add Supabase Edge Functions for:

- publish workflows requiring privileged writes
- import/export jobs
- more complex validation or migration tasks
- webhook-driven processes later

Do not start with Edge Functions for basic CRUD.

## Frontend Integration Plan

### Introduce persistence adapters per entity

For each migrated content type, create a small adapter layer in `apps/web` that exposes a stable interface such as:

- `loadPublishedCity`
- `loadEditableCityDraft`
- `saveRemoteCityDraft`
- `publishCityDraft`
- `resetCityDraftToPublished`

Do not scatter Supabase client calls through large React components.

### Keep local draft buffering

During transition:

- keep immediate UI edits local in component state
- optionally persist temporary unsynced work in localStorage
- sync to Supabase via explicit save actions

This reduces risk while preserving current editor responsiveness.

### Update Play data flow

Once city data is migrated:

- Play should resolve city boards from published remote content, not bundled JSON, for migrated cities
- keep bundled JSON as fallback during rollout

Recommended migration flag:

- use a simple per-city or per-entity source switch while rollout is incomplete

## Migration Mechanics

### Seed strategy

For each entity family:

1. export current checked-in content
2. import into Supabase as initial published versions
3. mark source provenance in metadata where helpful
4. keep repo content as seed material until rollout is stable

### Import/export strategy

Keep file import/export support, but redefine its role:

- export:
  - backup
  - editorial review
  - repo sync if desired
- import:
  - bootstrap or manual restore

Agents should avoid presenting file save as the primary source of truth after migration.

## Testing Plan

### Add tests where logic changes

Focus on:

- draft vs published resolver behavior
- migration adapters
- fallback behavior when offline or unauthenticated
- publish/reset flows
- save-match loading after remote persistence

### Minimum validation matrix

- load with no remote draft
- save remote draft
- publish draft
- reset draft to published
- load Play against published city data
- fall back to bundled/local data when backend unavailable during staged rollout

## Risks

### Risk: scope expansion

Mitigation:

- migrate cities first
- delay realtime, collaboration, and multiplayer

### Risk: frontend regression in large editor components

Mitigation:

- hide persistence changes behind narrow adapters
- avoid rewriting large UI panels unless required

### Risk: schema churn

Mitigation:

- start with JSONB payload version tables
- keep Zod contracts authoritative

### Risk: unclear anonymous vs authenticated behavior

Mitigation:

- decide early whether public users can remote-save matches
- if unclear, keep remote saves authenticated-only first

## Suggested Task Breakdown for Agents

### Agent task 1

Define persistence contracts and adapter interfaces for migrated entities.

Target areas:

- `apps/web`
- `packages/content-schema` only if strictly required

### Agent task 2

Implement Supabase client setup and city persistence adapters.

Target areas:

- `apps/web`

### Agent task 3

Implement city draft/publish UI state wiring without broad component rewrites.

Target areas:

- `apps/web/src/components/EdinburghReviewPage.tsx`
- related city editor modules

### Agent task 4

Seed current city content into Supabase and document import process.

Target areas:

- `content/`
- migration scripts or docs

### Agent task 5

Migrate role catalog persistence.

Target areas:

- `apps/web`
- role-related content seed path

## Immediate Next Step Recommendation

If implementation starts now, the first concrete task should be:

1. define the city persistence contract
2. create Supabase tables for `cities` and `city_versions`
3. seed Edinburgh as the first published city
4. wire Cities editor to `remote_draft` plus explicit publish/reset actions
5. leave Play reading bundled content until the city read path is verified
6. switch Play city reads to published remote content after verification

This sequence keeps Milestone 2 stable while making real progress on Milestone 6.

## Open Questions For The User

These answers will affect implementation details:

1. Should anonymous users be able to save matches remotely, or should remote saves require login?
2. Do you want published content edits limited to you for now, or should we plan for multiple editors immediately?
3. Do you want repo `content/` files to remain part of the editorial workflow long-term, or only as seed/export artifacts after migration?
4. For the public site, should Play always use published data only, or do you want a private editor preview mode that can load drafts?

## Source References

- [docs/PRD.md](/abs/path/c:/workspace/narrative-chess/docs/PRD.md:1)
- [apps/web/src/cityReviewState.ts](/abs/path/c:/workspace/narrative-chess/apps/web/src/cityReviewState.ts:1)
- [apps/web/src/fileSystemAccess.ts](/abs/path/c:/workspace/narrative-chess/apps/web/src/fileSystemAccess.ts:1)
- [apps/web/src/savedMatches.ts](/abs/path/c:/workspace/narrative-chess/apps/web/src/savedMatches.ts:1)
