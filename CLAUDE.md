# Narrative Chess V2

## Memory Management

This project keeps a local memory tree at `.claude/memory/`.

### Structure

- `memory.md` — index of all project memory files, updated whenever you create or modify one
- `general.md` — project conventions, preferences, environment setup
- `domain/{topic}.md` — domain-specific knowledge (one file per topic)
- `tools/{tool}.md` — tool configs, CLI patterns, workarounds

### Rules

1. When you learn something worth remembering, write it to the right file immediately
2. Keep `memory.md` as a current index with one-line descriptions
3. Entries: date, what, why — nothing more
4. Read `.claude/memory/memory.md` at session start. Load other files only when relevant
5. If a file doesn't exist yet, create it
6. Before removing or modifying any existing memory entry, use `AskUserQuestion` to confirm
   with the user — show the current content and the proposed change

### Maintenance

When the user says "reorganize memory":
1. Read all memory files
2. Remove duplicates and outdated entries
3. Merge entries that belong together
4. Split files that cover too many topics
5. Re-sort entries by date within each file
6. Update `memory.md` index
7. Show a summary of what changed

## Global Memory

Cross-project memory lives at `~/.claude/memory/` (see `~/.claude/CLAUDE.md`).

At session start, read **both** in order:
1. `~/.claude/memory/memory.md` — cross-project index
2. `.claude/memory/memory.md` — this project's index

Project memory takes precedence on conflict; promote anything reusable to global.

## Domain Knowledge Lifecycle

1. Staging — knowledge accumulates in `.claude/memory/domain/{name}/`
2. Promotion — enough knowledge exists to package as a plugin/skill
3. Pointer — after promotion, the memory file becomes a pointer to the plugin;
   content lives in the plugin

When an update is needed to a promoted domain, note it in the memory file so an issue
can be created on the plugin repo.

## Wiki

Project knowledge graph lives in `wiki/` (Obsidian vault). See `wiki/CLAUDE.md` for
folder layout, naming, linking, and write-policy conventions.

Three-way split:
- `.claude/memory/` — machine-curated, AI auto-context (preferences, conventions, identity)
- `wiki/` — human-readable knowledge graph (decisions, research, people, projects, daily logs)
- `docs/` — formal artefacts (PRDs, specs, public docs)

When unsure where a piece of info belongs: half-formed thoughts → `wiki/`; AI-context facts
→ `.claude/memory/`; formal/public docs → `docs/`.

## AI rails for v2 implementation

### Stack pin

Next.js 16.2, React 19, TypeScript, Tailwind v4, shadcn/ui, Supabase JS + SSR, chess.js, Zod.

### Knowledge cutoff caveat

Claude's training cutoff is older than this stack. Verify Next.js / Supabase syntax against
current docs (use WebFetch on the relevant docs page) before introducing patterns not already
in the repo.

### File invariants

- DB writes only via Server Actions. Client never imports `service_role` key.
- Migrations only via `supabase migration new <name>`. Never edit a migration after `supabase db push`.
- chess.js imported only in `lib/chess/engine.ts`. Wrap, never spread.
- RLS policies live in same migration as the table they guard.
- Realtime publication changes always co-located with the relevant table migration.

### What NOT to touch

- `node_modules/` (rebuild from `bun install`)
- Past migrations (write a new one that alters)
- `auth.users` table directly — use `public.profiles` for app data

### Verification commands

- `bun run lint` — ESLint
- `bunx tsc --noEmit` — TypeScript check
- `bunx playwright test` — e2e
- `supabase db lint` — Supabase advisors (when Supabase CLI is installed)

### Pulling content from v1

`git clone https://github.com/redlamp/narrative-chess-v1 ../narrative-chess-v1` separately.
Copy what's needed by hand. Never auto-import.

### Branch + commit conventions

- `feat/<short-name>` off `dev`. PR back to `dev`.
- `dev` → `main` via PR with linear history (no merge commits) and CI green.
- **Never commit directly to `main`.** All work lands via `dev`. If you find yourself
  on `main` with uncommitted changes, switch to `dev` (or a feature branch off `dev`)
  before committing.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `ci:`.

### Commit policy (overrides default "only commit when asked")

- **Commit proactively** when a coherent unit of work is finished. Don't fragment a
  single solution across prompt-commit-prompt-commit cycles — that pattern is wasteful
  and obscures intent. A solid commit captures one complete change with full context.
- **One topic per commit.** If the working tree contains unrelated changes
  (e.g., a spec doc + wiki edits + a `.gitignore` tweak), split them into separate
  commits — one per topic. Don't bundle unrelated edits because they happened in
  the same session.
- **Stage files explicitly by name.** Avoid `git add -A` / `git add .` to prevent
  accidental inclusion of secrets, runtime artifacts, or stray scratch files.
- **Destructive operations still need explicit approval.** Force-push, hard reset,
  branch deletion, amending published commits — ask first, even when committing
  routinely is fine.
- When in doubt about whether something is "ready," err toward committing the
  finished part and leaving the in-flight part uncommitted.

### Source of truth

- Design spec: `docs/superpowers/specs/2026-05-02-v2-foundation-design.md`
- Active implementation plan: `docs/superpowers/plans/` (latest dated file = current phase)
- Decisions: `wiki/notes/decision-*.md`, indexed at `wiki/mocs/decisions.md`
- Realtime+RLS gate procedure: `wiki/notes/realtime-rls-gate-procedure.md` (run whenever
  RLS or Realtime publication changes)
