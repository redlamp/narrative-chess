# Narrative Chess V2

## Memory Management

Local project memory tree at `.claude/memory/` (distinct from global `~/.claude/memory/`).

### Structure

- `memory.md` — index of all project memory files, updated whenever you create or modify one
- `general.md` — project conventions, preferences, environment setup
- `domain/{topic}.md` — domain-specific knowledge (one file per topic)
- `tools/{tool}.md` — tool configs, CLI patterns, workarounds

### Rules

1. Learn something worth remembering, write to right file immediately
2. Keep `memory.md` as current index with one-line descriptions
3. Entries: date, what, why — nothing more
4. Read `.claude/memory/memory.md` at session start. Load other files only when relevant
5. File missing, create it
6. Before removing or modifying existing memory entry, use `AskUserQuestion` to confirm
   with user — show current content + proposed change

### Maintenance

User says "reorganize memory":
1. Read all memory files
2. Remove duplicates + outdated entries
3. Merge entries belong together
4. Split files cover too many topics
5. Re-sort entries by date within each file
6. Update `memory.md` index
7. Show summary of changes

## Global Memory

Cross-project memory at `~/.claude/memory/` (see `~/.claude/CLAUDE.md`).

Session start, read **both** in order:
1. `~/.claude/memory/memory.md` — cross-project index
2. `.claude/memory/memory.md` — this project's index

Project memory wins on conflict; promote reusable to global.

## Domain Knowledge Lifecycle

1. Staging — knowledge accumulates in `.claude/memory/domain/{name}/`
2. Promotion — enough knowledge to package as plugin/skill
3. Pointer — after promotion, memory file becomes pointer to plugin;
   content lives in plugin

Update needed for promoted domain, note in memory file so issue
can be filed on plugin repo.

## Wiki

Project knowledge graph in `wiki/` (Obsidian vault). See `wiki/CLAUDE.md` for
folder layout, naming, linking, write-policy.

Three-way split:
- `.claude/memory/` — machine-curated, AI auto-context (preferences, conventions, identity)
- `wiki/` — human-readable knowledge graph (decisions, research, people, projects, daily logs)
- `docs/` — formal artefacts (PRDs, specs, public docs)

Unsure where info belongs: half-formed thoughts → `wiki/`; AI-context facts
→ `.claude/memory/`; formal/public docs → `docs/`.

## AI rails for v2 implementation

### Stack pin

Next.js 16.2, React 19, TypeScript, Tailwind v4, shadcn/ui, Supabase JS + SSR, chess.js, Zod.

### Knowledge cutoff caveat

Claude training cutoff older than stack. Verify Next.js / Supabase syntax against
current docs (WebFetch on relevant docs page) before new patterns not in repo.

### File invariants

- DB writes only via Server Actions. Client never imports `service_role` key.
- Migrations only via `supabase migration new <name>`. Never edit migration after `supabase db push`.
- chess.js imported only in `lib/chess/engine.ts`. Wrap, never spread.
- RLS policies live in same migration as table they guard.
- Realtime publication changes always co-located with relevant table migration.

### What NOT to touch

- `node_modules/` (rebuild from `bun install`)
- Past migrations (write new one that alters)
- `auth.users` table directly — use `public.profiles` for app data

### Verification commands

- `bun run lint` — ESLint
- `bunx tsc --noEmit` — TypeScript check
- `bunx playwright test` — e2e
- `supabase db lint` — Supabase advisors (when Supabase CLI installed)

### Pulling content from v1

`git clone https://github.com/redlamp/narrative-chess-v1 ../narrative-chess-v1` separately.
Copy needed by hand. Never auto-import.

### Branch + commit conventions

- `feat/<short-name>` off `dev`. PR back to `dev`.
- `dev` → `main` via PR with linear history (no merge commits) + CI green.
- **Never commit directly to `main`.** All work lands via `dev`. On
  `main` with uncommitted changes, switch to `dev` (or feature branch off `dev`)
  before committing.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `ci:`.

#### When direct push to `dev` is OK (vs feat-branch + PR)

GitHub branch protection on `dev` requires PRs but allows admin bypass
(`enforce_admins=false`). Convention path-based, enforced by us, not rule:

| Path / change type | Route |
|---|---|
| `wiki/**` | direct push to `dev` OK |
| `.claude/memory/**` | direct push to `dev` OK |
| `docs/**` (specs, plans) | direct push to `dev` OK |
| `CLAUDE.md`, `AGENTS.md`, `README.md`, `wiki/CLAUDE.md` | direct push to `dev` OK |
| Anything in `app/`, `components/`, `lib/`, `supabase/migrations/`, `package.json`, config | feat-branch + PR |
| Mixed change touching both | feat-branch + PR (treat as code) |

Why: code changes need CI lint+typecheck+e2e gating + PR review surface; docs and
memory don't ship runtime behavior, routing through PRs adds friction
without catching anything CI would flag.

### Commit policy (overrides default "only commit when asked")

- **Commit proactively** when coherent unit of work finished. Don't fragment
  single solution across prompt-commit-prompt-commit cycles — wasteful
  + obscures intent. Solid commit captures one complete change with full context.
- **One topic per commit.** Working tree has unrelated changes
  (e.g., spec doc + wiki edits + `.gitignore` tweak), split into separate
  commits — one per topic. Don't bundle unrelated edits from
  same session.
- **Stage files explicitly by name.** Avoid `git add -A` / `git add .` — prevent
  accidental inclusion of secrets, runtime artifacts, stray scratch files.
- **Destructive ops still need explicit approval.** Force-push, hard reset,
  branch deletion, amending published commits — ask first, even when routine
  commit fine.
- Doubt about "ready," err toward committing finished part, leave in-flight
  part uncommitted.

### Source of truth

- Design spec: `docs/superpowers/specs/2026-05-02-v2-foundation-design.md`
- Active implementation plan: `docs/superpowers/plans/` (latest dated file = current phase)
- Decisions: `wiki/notes/decision-*.md`, indexed at `wiki/mocs/decisions.md`
- Realtime+RLS gate procedure: `wiki/notes/realtime-rls-gate-procedure.md` (run whenever
  RLS or Realtime publication changes)