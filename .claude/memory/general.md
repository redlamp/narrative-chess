# Narrative Chess V2 - Project Conventions

## Writing & Naming Conventions

- Decisions captured in `wiki/notes/decision-*.md` (atomic note per decision, lowercase kebab-case filenames)
- Specs at `docs/superpowers/specs/YYYY-MM-DD-<topic>.md`
- Plans at `docs/superpowers/plans/YYYY-MM-DD-<phase>.md`
- Daily logs at `wiki/daily/YYYY-MM-DD.md`
- Wiki cross-links use Obsidian wikilinks `[[note-name]]` (no `.md` extension)

## Workflow Preferences

- Commit style: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `ci:`, `refactor:`)
- Branch policy: `feat/<short-name>` off `dev`; PR back to `dev`; `dev` → `main` via PR with linear history; CI green required
- Reviews: code-review skill, ultrareview when needed; CI gates lint + typecheck + e2e (per Phase 1 plan)

## Workspace Pointers

- Source of truth for project design: `docs/superpowers/specs/2026-05-02-v2-foundation-design.md`
- Active implementation plan: `docs/superpowers/plans/2026-05-02-v2-phase-1-repo-and-ci.md` (latest dated file is current)
- Wiki conventions: `wiki/CLAUDE.md`
- Three-way info split (per [[decision-three-way-info-split]]):
  - `.claude/memory/` (this) — AI auto-context: preferences, conventions, identity
  - `wiki/` — human knowledge graph: decisions, daily logs, projects, research
  - `docs/` — formal artifacts: specs, plans, ADRs, public docs
