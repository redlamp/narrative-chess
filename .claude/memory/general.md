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
- All M1 phase plans are shipped (`docs/superpowers/plans/2026-05-02-*` through `2026-05-03-v2-phase-6-*`). Latest dated file in `docs/superpowers/plans/` is the current plan; if no later-dated file exists than phase 6, M1 is closed and the next milestone (M1.5 or M2) hasn't started.
- Project status snapshot: `wiki/projects/narrative-chess-v2.md` Status section.
- Wiki conventions: `wiki/CLAUDE.md`
- Three-way info split (per [[decision-three-way-info-split]]):
  - `.claude/memory/` (this) — AI auto-context: preferences, conventions, identity
  - `wiki/` — human knowledge graph: decisions, daily logs, projects, research
  - `docs/` — formal artifacts: specs, plans, ADRs, public docs

## Ship facts

- Stable production alias: https://narrative-chess.vercel.app
- M1 squash on `main`: `e81a3d9` (2026-05-03) — Phases 1–6.
- M1.5 squash on `main`: `681f809` (2026-05-04) — Phase 7 + banner fix + header nav + Phase 8 landing/3D hero.
- M1.5+ squash on `main`: `67243d5` (2026-05-04) — Hero3D context recovery + AuthDialog onSuccess + Theme toggle + dev-only fool's mate smoke + husky pre-commit shebang chore. Bundled PR #20/#23/#21/#22/#24 from `dev` via PR #25.
- M1.5+ prod deploy: https://narrative-chess-4a3g8vzog-taylor-8571s-projects.vercel.app
- Post-ship lessons live as `wiki/notes/lesson-*.md`.
- Step N — `gh repo edit redlamp/narrative-chess-v1 --visibility private --accept-visibility-change-consequences` — NOT yet run; do after production smoke is satisfying. Always wait for explicit user go.
