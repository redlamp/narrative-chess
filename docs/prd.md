# Narrative Chess — Product Requirements Document (Working Draft)

## 1. Overview

**Codename:** Narrative Chess  
**Product Type:** Web-based chess game with a generative narrative layer.  
**Premise:** A chess game where the board is a real city, the pieces are people, and every move contributes to an emergent social narrative.

Narrative Chess reinterprets the rules and structure of chess through urban geography, character systems, and story generation. Each board maps to a city. Each square maps to a neighborhood, district, or borough. Each piece becomes a person with a role, background, motivations, and evolving history. As players make moves, the game generates narrative context around those actions, transforming abstract strategy into an unfolding story.

The project begins as a playable digital chess experience with a strong data foundation for later narrative and visual expansion. Over time, it grows into a hybrid of strategy game, city simulator, character generator, and comic/story engine.

## 2. Vision

Create a chess-driven storytelling system where:

- classic chess rules remain legible and intact
- city geography shapes tone, identity, and character origin
- pieces feel like people rather than tokens
- each move builds narrative momentum
- the same chess match can be retold as a dramatic, funny, tragic, or absurd story

The long-term aspiration is for a completed match to feel like both:

1. a strategically valid chess game
2. a coherent, replayable story artifact

## 3. Product Goals

### Primary Goals

- Deliver a solid, readable, enjoyable digital chess foundation.
- Build a framework for city-based boards tied to real places.
- Generate distinctive characters from piece type + city + neighborhood + team context.
- Produce a lightweight narrative log that reacts to gameplay events.
- Establish technical foundations for later 3D, visual vignette, and comic-book output.

### Secondary Goals

- Enable players to compare how the same opening or classic game becomes a different story in different cities.
- Support online play and spectatorship later.
- Create a system that can scale from text-first narrative to illustrated or cinematic presentation.

### Non-Goals for Initial Release

- Fully simulated open-world city navigation.
- AAA-quality character rendering.
- Real-time action gameplay.
- Fully voice-acted or authored branching dialogue.
- Complex combat simulation beyond chess resolution.

## 4. Core Design Pillars

### 4.1 Chess First

The game must remain understandable and functional as chess. Narrative should enrich the game, not obscure legal moves, board state, or turn structure.

### 4.2 Place Matters

The city is not cosmetic. Neighborhood identity, socioeconomic cues, local landmarks, and cultural context should meaningfully influence the tone and construction of characters.

### 4.3 Pieces Are People

Every piece should feel like an individual with a role, traits, and a potential arc.

### 4.4 Emergent Story Over Fixed Plot

The game should generate compelling narrative framing around moves rather than requiring fully authored storylines.

### 4.5 Tone Range

Narrative outcomes can be comic, dramatic, absurd, political, intimate, or disturbing. The system should support tonal variation without defaulting to moral simplicity.

### 4.6 Avoid Harmful Reduction

The system must avoid simplistic or offensive mappings around race, class, religion, gender, or morality. Rival teams should be framed through institutions, factions, sports, unions, families, political machines, or local subcultures rather than crude identity binaries.

## 5. Experience Summary

A player starts a match in a selected city. The standard 8x8 board is visible in an abstract board mode. Each square corresponds to a real neighborhood or subdistrict. The player can switch to a city/map mode that presents the board through city and district context. In early milestones, this may be a simpler labeled or overlaid map view rather than a full board-to-city morph.

Each piece begins the game as a generated character informed by:

- piece type
- side/faction
- starting district
- local city context
- team narrative framing

As pieces move, capture, protect, pressure, sacrifice, or promote, the game records and narrativizes these actions. The result is both a chess move history and a character/story history.

## 6. Gameplay Concept

### 6.1 Board as City

- The board remains 8x8 in game logic.
- Each square maps to a neighborhood, district, or subdistrict of a real city.
- Board mode preserves chess readability.
- Map mode visualizes the city and district layout.
- Day/night square treatment reflects white/black square parity and can imply temporal rhythm.

### 6.2 Square Identity

Each square should ideally contain:

- district/neighborhood name
- high-level descriptors (residential, nightlife, industrial, affluent, student-heavy, historic, waterfront, etc.)
- socioeconomic/cultural tags
- optional landmark hooks
- narrative tone cues

### 6.3 Piece Identity

Pieces should feel like distinct people shaped by role, place, faction, and emerging history. For the first playable version, character identity should stay lightweight and readable. The canonical implementation schema for early character generation is defined in **Section 10.1 First Playable Character Schema**.

### 6.4 Teams / Factions

Teams replace simplistic good-vs-evil framing with situational rivalries. Examples:

- rival unions
- political factions
- sports supporters
- crime families
- neighborhood coalitions
- media empires
- activist groups
- city agencies in conflict

The same visual side can represent different faction setups in different matches.

### 6.5 Capture Interpretation

Captures do not always imply death. Capture may be narrated as:

- arrest
- public humiliation
- social ousting
- scandal
- deplatforming
- exposure
- career ruin
- blackmail
- displacement
- injury
- disappearance
- murder

The framing depends on tone, character type, city, and prior events.

### 6.6 Promotion

Pawn promotion is a major narrative moment. The piece may gain:

- a new role
- new status
- changed name presentation
- altered aesthetic
- transformed narrative vocabulary

Promotion should often rhyme with the pawn’s origin while reflecting reinvention.

## 7. Narrative System

### 7.1 Narrative Layers

The narrative system should evolve in layers.

#### Layer 1: Event Log
A structured move log with flavor text.

Examples:
- Phillip patrols Newhaven.
- Aisha cuts through Leith and applies pressure downtown.
- Camila exposes Darren and forces him off the board.

#### Layer 2: Character Memory
Events become part of each character’s record.

Examples:
- falsely accused another character
- survived a near capture
- defended the king twice
- spent most of the game shielding the back rank

#### Layer 3: Relational Hooks
Previous actions can be referenced later.

Examples:
- a liar later gets exposed
- a cautious character becomes reckless
- a neglected piece makes a decisive intervention

#### Layer 4: Scene Generation
Important moves can be reframed as vignettes or comic panels.

### 7.2 Tone Engine
Narrative output should support adjustable tone presets:

- grounded realism
- dark comedy
- tabloid melodrama
- civic noir
- absurd satire
- tragic urban drama

### 7.3 Narrative Constraints
The system should avoid:

- making immutable traits the reason for morality
- overusing violence
- flattening neighborhoods into stereotypes
- generating offensive character mappings without explicit, intentional framing

## 8. City System

### 8.1 Initial City Candidates
Recommended first cities:

- Edinburgh
- New York City
- Los Angeles
- Amsterdam

### 8.2 City Selection Criteria
A candidate city should ideally have:

- recognizable district identity
- strong public map data availability
- clear cultural texture
- diverse population and occupations
- useful landmark density
- interesting class, political, and social contrasts

### 8.3 City-to-Board Mapping Rules
Requirements:

- 64 board cells must map to 64 coherent districts or subdistricts
- mappings should feel intuitive where possible
- existing neighborhoods should be reused before inventing arbitrary divisions
- large districts may be split naturally by roads, rivers, landmarks, or known sub-areas
- neighboring tiles should broadly preserve geographic proximity where practical

### 8.4 City Research Data Model
For each district, capture:

- name
- parent borough or administrative area
- summary description
- land use type
- class or economic cues
- demographic texture at a high level
- political or cultural notes
- notable institutions or landmarks
- day and night energy profile
- candidate occupations for resident characters

## 9. Views and UX

### 9.1 Board View
Primary gameplay surface.

Requirements:

- highly legible chessboard
- standard move highlighting
- selected piece state
- history log
- hover or click details for piece identity
- optional narrative snippets

### 9.2 Map View
A city-referenced interpretation of the board.

Requirements:

- district labels or overlays
- selected piece remains readable
- valid move destinations clearly highlighted
- simple contextual city view in early milestones
- optional richer map or 3D presentation later

### 9.3 Character Info Panel
Should show:

- name
- role
- district of origin
- faction
- traits
- current status
- key past actions
- one-line description

### 9.4 Narrative Panel / Match Chronicle
Should show:

- move history
- flavored event log
- major turning points
- optional filters by character

## 10. Character Data and Generation Constraints

### 10.1 First Playable Character Schema
For the first playable version, each piece should be assigned:

- full name
- role
- district of origin
- faction
- 4-6 traits selected from a larger curated pool of 10-20 traits
- 4-6 verbs selected from a larger curated pool of 10-20 verbs
- one-line description

Later versions may expand character detail, but early milestones should keep identity readable, lightweight, and safe to generate procedurally.

### 10.2 Generation Constraints

- separate appearance or style from moral framing
- allow some fields to be unknown, omitted, or deferred
- do not make immutable identity traits the cause of good or evil alignment
- allow culturally progressive and diverse character representation
- allow antagonistic or harmful characters, including racists, bigots, and other hostile social roles, when they serve the narrative, but do not frame those traits as culturally representative of groups or neighborhoods
- prefer broad plausibility and editorial restraint over overconfident specificity

### 10.3 Structured Character Model

- id
- match_id
- piece_id
- piece_type
- faction
- district_origin
- first_name
- middle_name
- last_name
- display_name
- role
- trait_ids
- verb_ids
- one_line_description
- appearance_tags
- cultural_context_notes
- memory_log
- status
- generation_source
- generation_model
- content_status (`empty`, `procedural`, `authored`)
- review_status (`empty`, `needs review`, `reviewed`, `approved`)
- review_notes
- last_reviewed_at

### 10.4 Notes on Character Data

Early versions should avoid broad procedural generation of sensitive demographic fields such as religion, sexuality, or ethnicity as explicit structured data. The main risks are stereotype reinforcement, overconfident inference, flattening neighborhoods into caricature, and accidentally making identity traits feel causally linked to morality.

To reduce those risks:
- keep the early schema focused on role, district, traits, verbs, and description
- use optional `cultural_context_notes` only where grounded in reviewed city content
- allow identity-relevant details to remain unknown, omitted, or implied lightly in authored text later
- separate style and presentation from ethical alignment or narrative worth

## 11. Recommended MVP

### 11.1 MVP Slice

- standard playable chess
- one city only: Edinburgh
- board mode plus simple map mode
- district labels for all 64 cells
- generated text-only character bios for all pieces
- flavored narrative event log for moves and captures
- no online play yet
- no 3D city mesh requirement yet
- no full comic generation yet

### 11.2 Prototype Sequencing

#### Prototype A — Core Local Chess
- local playable chess
- move history and undo
- minimal narrative event hooks
- optional low-skill legal-move opponent
- no real city data required yet

#### Prototype B — Edinburgh Board
- Edinburgh district mapping added to the board
- district labels and basic city context in UI
- board and city data coordinated through shared schemas
- simple map-mode support without requiring board-to-city morph

## 12. Technical Recommendation

### 12.1 App Structure
Use a lightweight monorepo to support agent parallelism while keeping the repository manageable on a basic GitHub account.

Recommended structure:
- `apps/web` — primary React application
- `packages/game-core` — chess logic wrappers, rules integration, and game-state helpers
- `packages/content-schema` — shared TypeScript/Zod schemas
- `packages/narrative-engine` — event generation, templates, and memory hooks
- `content/cities` — city and district data
- `content/templates` — narrative templates, verbs, and tone presets
- `docs` — design notes, research, and workflow docs
- `AGENTS.md` — project-level guidance for agentic coding tools

This structure should remain simple at the start. New packages should only be introduced when there is a clear ownership boundary or reuse case.

### 12.2 Frontend
React + TypeScript + shadcn/ui

### 12.3 Board Rendering
Start with a 2D chess board to validate gameplay clarity, board interactions, and the basic narrative layer. Map elements should follow after the core chess experience is working. If the proof of concept is strong, the project can later move to a Three.js-based 3D board and city presentation.

### 12.4 3D / Spatial Layer
Three.js is the planned path for later board-space presentation, but it is not required for the initial prototype.

### 12.5 Game Logic
Use a validated chess rules library such as chess.js early, wrapped with custom narrative hooks. For solo play, investigate existing lightweight chess AI or engine integrations appropriate for hobbyist-level play. The first goal is a simple, approachable player-vs-computer mode rather than a highly advanced opponent.

### 12.6 State Management
Zustand or Redux Toolkit. Zustand is likely enough at the beginning.

### 12.7 Backend / Data Layer
Supabase or another PostgreSQL-backed service for:

- city data tables
- district metadata
- character generation templates
- saved games
- user accounts later
- online game state later

## 13. Data Model (High Level)

### 13.1 City

- id
- name
- country
- style_tags
- faction_presets
- district_map

### 13.2 District

- id
- city_id
- name
- board_coordinate
- borough
- descriptors
- landmarks
- day_profile
- night_profile
- role_biases

### 13.3 Match

- id
- city_id
- factions
- opening_seed
- move_history
- event_history
- result

### 13.4 Event

- id
- match_id
- move_number
- event_type
- actor_character_id
- target_character_id
- location_district_id
- generated_text
- tags

## 14. Risks

### Design Risks

- narrative overwhelms chess readability
- city mappings feel arbitrary or forced
- generated characters become repetitive or stereotyped
- the tone shifts too wildly to feel coherent

### Technical Risks

- geospatial rendering complexity grows too early
- online multiplayer adds too much architecture burden before the core is proven
- content schema becomes too broad before use cases are validated

### Ethical Risks

- neighborhoods represented reductively
- demographic inference handled insensitively
- faction framing accidentally creates harmful optics

## 15. Open Questions and Current Decisions

- **Is the main fantasy competitive chess with flavor, or storytelling through chess with strategy support?**  
  This remains open, but the current direction is to preserve chess as the foundation while building strong narrative support around it.

- **Should the system support solo play vs AI in the first public prototype?**  
  Yes, if a simple chess AI or lightweight engine integration is readily available. The target is a hobbyist-friendly player-vs-computer mode. This should not delay the core playable prototype if AI integration becomes a distraction.

- **Should each city be hand-crafted or partially automated?**  
  Cities should be based on open city and district data, then passed through a research and editorial phase so they feel accurate and intentional. They should not be generated on the fly during play.

- **How authored vs procedural should bios be?**  
  Bios should start procedural. Content that is procedural or AI-generated should be flagged as such. Over time, the project should support a transition toward more authored content, and the system should track whether content is procedural, reviewed, or fully authored.

- **When should the project shift from text-only to models?**  
  This should be evaluated after proof of concept for basic gameplay and basic narrative is in place. Visual models should follow validated game feel and narrative value, not lead them.

## 16. Milestones and Agentic Workstreams

The phase list above describes product scope evolution. The milestone plan below translates that scope into practical delivery slices that can be worked on in parallel.

Each milestone includes suggested agentic roles that can be run independently in VS Code with Claude Code. These roles should be treated as bounded contributors with clear input/output contracts, not as fully autonomous owners of product direction. The human developer remains responsible for final integration, taste, and prioritization.

### Milestone 0 — Project Foundation

**Objective:** Establish repo structure, development conventions, core tooling, and integration boundaries before feature work accelerates.

**Deliverables:**

- monorepo or clean app/package structure
- TypeScript, linting, formatting, and test setup
- baseline React app with shadcn/ui installed
- initial project documentation, including `AGENTS.md`
- content folder strategy for cities, factions, and templates
- schema validation approach for game content
- contribution conventions for human + agent collaboration

**Suggested agentic roles:**

- **Scaffold Agent** — sets up project structure, package layout, scripts, and common tooling
- **Frontend Foundation Agent** — installs and configures React, shadcn/ui, layout shell, theming, and basic app chrome
- **Rendering Sandbox Agent (optional / exploratory)** — creates a minimal rendering sandbox for future board experimentation, including lightweight Three.js tests only if useful and non-disruptive to the 2D-first plan
- **Content Schema Agent** — defines TypeScript/Zod schemas for city, district, character, match, and event content
- **Dev Workflow Agent** — drafts README, coding conventions, branch/file patterns, and prompts for Claude Code sessions

**Parallelization notes:**
Most work here can happen independently so long as package boundaries are agreed first.

### Milestone 1 — Core Chess Vertical Slice

**Objective:** Deliver a clean, fully playable local chess experience with a strong UI foundation.

**Deliverables:**

- legal chess rules
- piece movement and capture handling
- move history and notation
- undo / step-back support
- selected-piece and valid-move highlighting
- game-end conditions
- baseline responsive UI shell
- minimal narrative event log using a simple pattern such as `[character][verb][target]`
- optional lightweight solo play against a simple computer opponent if integration is straightforward

**Pass / fail targets:**
- a player can complete a full local game
- all legal moves are validated correctly
- check, checkmate, and stalemate are surfaced in the UI
- undo restores the exact prior game state
- a minimal narrative event is generated for every move
- if the AI opponent is included, it completes legal turns reliably at a hobbyist-friendly level

**Non-goals:**
- multiplayer
- 3D board rendering
- authored city research
- advanced AI opponent strength
- comic, vignette, or export systems

**Suggested agentic roles:**

- **Chess Logic Agent** — wraps chess.js or equivalent and exposes clean game state APIs
- **Board UI Agent** — builds the board, coordinates, selection states, legal move highlights, and piece rendering
- **Game State Agent** — manages state transitions, history stack, derived selectors, and persistence hooks
- **Narrative Hook Agent** — adds basic move-to-text hooks and simple narrative event generation
- **Interaction QA Agent** — writes tests for legal moves, captures, check/checkmate, stalemate, and undo
- **UI Polish Agent** — improves spacing, panel structure, typography, and interaction clarity without changing logic
- **AI Opponent Agent** — investigates and integrates a basic low-skill legal-move opponent if feasible without disrupting milestone scope

**Parallelization notes:**
Chess Logic Agent and Board UI Agent can work in parallel if the state contract is defined early.

### Milestone 2 — City Board Prototype

**Objective:** Replace abstract squares with district-aware board data for one city.

**Deliverables:**

- one fully mapped city board, recommended: Edinburgh
- 64 board coordinates mapped to neighborhoods/subdistricts
- district metadata model populated for the first city
- board labels and district details visible in UI
- board view and simple map view toggle

**Pass / fail targets:**
- Edinburgh board data loads correctly into the game
- all 64 board cells have assigned district identities
- neighboring tiles broadly preserve geographic proximity where practical
- city research data and board mapping share reusable structured fields
- district labels and metadata are inspectable in the UI

**Non-goals:**
- perfect real-world spatial fidelity
- full geospatial rendering
- automated city generation during play
- final-quality authored city writing for every district

**Suggested agentic roles:**

- **City Research Agent** — gathers district names, boundary logic, landmark hooks, and high-level socioeconomic descriptors
- **Board Mapping Agent** — translates the chosen city into a coherent 64-cell board mapping
- **Map View Agent** — builds the city toggle, district overlays, and readable move highlighting in map mode
- **Data Entry Agent** — converts research into structured JSON/YAML/content records using the agreed schema
- **Content QA Agent** — checks naming consistency, duplicate districts, tone issues, and mapping clarity

**Parallelization notes:**
City Research Agent and Board Mapping Agent should coordinate early so research data and board structure share reusable fields. Map View Agent can proceed once the board mapping format is known.

### Milestone 3 — Character Generation System

**Objective:** Give every piece a generated human identity grounded in role, place, and faction.

**Deliverables:**

- character schema finalized
- archetype role pools per piece type
- first-pass naming strategy
- district-informed trait generation
- hover/click character cards
- piece metadata stored in match state

**Pass / fail targets:**
- every piece in a match receives a valid character payload
- generated characters conform to the approved lightweight schema
- traits and verbs are selected from curated pools and displayed correctly
- character cards render consistent, readable data in the UI
- generated outputs avoid obvious repetition, contradiction, or reductive combinations in sample matches

**Non-goals:**
- deep social network simulation
- broad structured demographic generation
- authored biographies for every piece
- final-quality visual character models

**Suggested agentic roles:**

- **Character System Agent** — defines generation rules and the character object model
- **Archetype Writing Agent** — expands role pools, verbs, traits, and social hooks for each piece type
- **Name and Identity Agent** — builds culturally grounded name pools and lightweight identity or presentation rules consistent with reviewed city content
- **Character Card Agent** — implements the UI panel/card for viewing piece details
- **Safety Review Agent** — reviews generated combinations for reductive, biased, or implausible outputs

**Parallelization notes:**
Character generation logic can be developed separately from the character card UI if sample payloads are mocked.

### Milestone 4 — Narrative Event Layer

**Objective:** Turn chess actions into readable narrative output.

**Deliverables:**

- flavored event log layered over move history
- action templates by piece type and event type
- capture interpretation rules
- initial character memory hooks
- tone preset support at a basic level

**Pass / fail targets:**
- every move produces a readable narrative event
- capture events use appropriate interpretation rules rather than defaulting to death
- narrative output reflects piece role, action type, and available context
- repeated sample games do not collapse into excessive template repetition too quickly
- basic character memory hooks can be recorded and referenced in later events

**Non-goals:**
- fully authored scene writing
- comic or vignette generation
- advanced continuity across multiple matches
- highly cinematic or literary prose generation

**Suggested agentic roles:**

- **Narrative Engine Agent** — translates moves into structured narrative events
- **Template Writing Agent** — writes and organizes event templates, verbs, and tone variants
- **Memory System Agent** — records character-level history that can be referenced later in text generation
- **Narrative UI Agent** — builds the match chronicle panel and event filtering views
- **Narrative QA Agent** — stress-tests repetition, incoherence, and tonal mismatch across simulated games

**Parallelization notes:**
Narrative Engine Agent and Template Writing Agent can move separately if the event schema is fixed.

### Milestone 5 — Visual Identity and 3D Presence

**Objective:** Introduce lightweight spatial and character representation without losing chess readability.

**Deliverables:**

- improved board presentation in 3D space
- low-fi piece or character stand-ins
- camera controls suited to a board game
- visual distinction between board mode and map mode
- basic atmosphere/shader experiments

**Suggested agentic roles:**

- **Board 3D Agent** — stages the board, camera, lighting, and selection feedback in Three.js
- **Piece Representation Agent** — prototypes low-fi modular character or silhouette systems
- **Shader and Atmosphere Agent** — explores day/night square treatment, district highlighting, and lightweight visual mood
- **Performance Agent** — monitors render complexity, bundle size, and interaction smoothness
- **Visual Integration Agent** — ensures the 3D layer still aligns with gameplay state and UI signals

**Parallelization notes:**
Piece Representation Agent and Shader and Atmosphere Agent can work independently once the render pipeline exists.

### Milestone 6 — Saved Matches and Content Infrastructure

**Objective:** Make the system durable enough to support iteration, replay, and future expansion.

**Deliverables:**

- persisted matches or exportable match snapshots
- content loading strategy for cities, templates, and factions
- admin/debug views for inspecting generated data
- backend or hosted data layer introduced only where needed

**Suggested agentic roles:**

- **Persistence Agent** — implements local save/load first, then optional hosted persistence
- **Backend Agent** — sets up Supabase/Postgres tables, auth assumptions, and content retrieval patterns if needed
- **Debug Tools Agent** — builds internal views for inspecting match state, character payloads, and narrative events
- **Content Pipeline Agent** — creates import/export tooling for city and narrative content
- **Schema Migration Agent** — maintains versioning and migration logic for evolving content models

**Parallelization notes:**
This milestone should start after schemas stabilize, but debug tooling can start earlier and grow over time.

### Milestone 7 — Multiplayer and Session Play

**Objective:** Add networked play only after the single-player/local prototype is strong.

**Deliverables:**

- room creation and joining
- synchronized move state
- server-authoritative or host-authoritative validation
- reconnect handling
- multiplayer-ready event log behavior

**Suggested agentic roles:**

- **Realtime Systems Agent** — builds synchronization layer and session lifecycle
- **Multiplayer Rules Agent** — validates legal moves and turn sequencing across clients
- **Lobby UI Agent** — creates room creation/join flow and status feedback
- **Session Recovery Agent** — handles reconnects, stale sessions, and conflict recovery
- **Netcode QA Agent** — simulates latency, duplicate actions, and ordering issues

**Parallelization notes:**
This should remain isolated from earlier milestones until the game state contract is stable.

### Milestone 8 — Narrative Vignettes and Story Artifact Output

**Objective:** Turn major moments into more memorable story artifacts.

**Deliverables:**

- selection rules for important moments
- simple staged scenes or keyframe vignettes
- exportable story recap or comic-like sequence
- end-of-match summary focused on arcs and turning points

**Suggested agentic roles:**

- **Scene Selection Agent** — identifies which events deserve expanded presentation
- **Vignette Staging Agent** — stages characters and environment for simple visual scenes
- **Story Recap Agent** — assembles the match into a summary artifact at the end
- **Export Agent** — prepares shareable text, image, or lightweight comic outputs
- **Narrative Continuity Agent** — checks that recap content aligns with the actual match log and character memory

## 17. AGENTS.md Guidance

The repository should include an `AGENTS.md` file at the root so tools like Codex and Claude Code have clear project instructions before making changes.

### Purpose of `AGENTS.md`

- define architecture boundaries
- define editing and ownership expectations
- define how agents should scope work
- define coding and testing expectations
- reduce drift between parallel agent threads

### Recommended contents of `AGENTS.md`

#### Project summary

- Narrative Chess is a web-based chess game with a generative narrative layer.
- The project prioritizes chess clarity first, narrative value second, and 3D/map presentation later.

#### Current priorities

- build a stable local chess prototype first
- include a minimal narrative event log early
- use a 2D board before introducing Three.js board rendering
- keep city data authored/reviewed rather than generated on the fly

#### Repository boundaries

- `apps/web` owns app UI and route-level composition
- `packages/game-core` owns chess rules integration and move/state logic
- `packages/content-schema` owns shared types and validation
- `packages/narrative-engine` owns event generation and memory hooks
- `content/` owns structured city and narrative content
- do not create new packages without a clear need

#### Agent rules

- prefer narrow, bounded tasks
- do not refactor unrelated files
- do not change shared schemas without explicit note and approval
- output integration notes when making non-trivial changes
- favor readable, maintainable code over clever abstractions
- preserve clear separation between gameplay logic, content, and presentation

#### Quality bar

- add tests for logic changes where practical
- avoid hidden magic values
- keep types explicit
- document assumptions in code comments sparingly and only where useful
- keep narrative templates and content data easy to inspect and edit

#### Narrative and content rules

- flag procedural or AI-generated content in the data model
- avoid reductive or stereotyped mappings
- do not make immutable identity traits the cause of moral alignment
- keep generated city content grounded in reviewed source data

#### Integration rules

- if a contract is unclear, define or update the interface first
- if parallel agents may conflict, prefer adding mock data and local interfaces over editing shared files prematurely
- when in doubt, leave a clear TODO rather than inventing broad architecture

## 18. Working Model for Claude Code Agents

To keep Claude Code productive, agentic roles should be scoped by file ownership and artifact type.

### Recommended constraints

- each agent should have a narrow responsibility
- each agent should write to a predictable folder or package
- shared contracts should be defined before parallel work starts
- one integration pass should merge and reconcile outputs
- one human review pass should approve architecture and tone

### Good boundaries for independent agents

- UI component work
- content schema work
- JSON/YAML content authoring
- chess logic wrappers
- test generation
- narrative template authoring
- map/district research and formatting
- debug/admin tooling

### Bad boundaries for independent agents

- broad "build the whole feature" tasks
- work that changes schemas and UI simultaneously without a contract
- parallel edits to the same central store or root app shell without coordination
- narrative generation without safety/tone constraints

### Recommended workflow in VS Code

1. Define the milestone target and the exact output artifact.
2. Define the contract, such as a TypeScript interface, JSON schema, or component props.
3. Spin up one Claude Code thread per bounded role.
4. Have each agent output code plus a brief integration note.
5. Perform a human-led merge and reconciliation pass.
6. Run tests and manual review before opening the next milestone.

## 19. Proposed Next Steps

1. Lock Milestone 0 and Milestone 1 scope.
2. Define repo/package structure before parallel agent work begins.
3. Establish core schemas for `City`, `District`, `Character`, `Match`, and `Event`.
4. Build the local chess vertical slice first.
5. Choose the first city and begin structured district mapping in parallel.
6. Add character generation only after the chess and city data contracts are stable.

## 20. Product Summary

Narrative Chess is strongest when treated as a chess game with a city-driven character and story engine, not as a full urban simulation. The best path is to establish clean chess fundamentals, then layer in one open-data-seeded, editor-reviewed city, one robust character schema, and one readable narrative log. If that version is compelling, the rest of the roadmap becomes much safer to build.

