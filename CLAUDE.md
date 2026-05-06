# Narrative Chess V2

## Memory Layers (post 2026-05-06 collapse)

Three layers, each with a clear job:

1. **Built-in project memory** — `~/.claude/projects/<mapped-path>/memory/`. Auto-injected by harness in the system prompt. Holds atomic feedback rules + identity only (4 `feedback_*.md` files). Don't grow this layer beyond cross-cutting rules I need every turn.
2. **Global memory** — `~/.claude/memory/`. Auto-injected once per session by SessionStart hook (`~/.claude/hooks/session-start-memory.{py,sh}`). Holds cross-project tool gotchas (Supabase CLI, react-19 lint, etc.). See `~/.claude/CLAUDE.md`.
3. **Wiki** — `wiki/` (Obsidian vault). Read on demand. Holds project state, decisions, daily logs, research, projects. See `wiki/CLAUDE.md`.

There is **no project `.claude/memory/` layer** — deleted 2026-05-06, content migrated to wiki + built-in. Decision: [[decision-collapse-memory-to-wiki]].

### Where new info goes

| Info type | Destination |
|---|---|
| Cross-cutting feedback rule (every turn) | Built-in `~/.claude/projects/.../memory/feedback_*.md` |
| Cross-project tool/lang gotcha | Global `~/.claude/memory/tools/` or `domain/` |
| Project decision + rationale | `wiki/notes/decision-*.md` |
| Project lesson learned | `wiki/notes/lesson-*.md` |
| Daily progress / half-formed | `wiki/daily/YYYY-MM-DD.md` |
| Formal spec / PRD | `docs/superpowers/specs/` |

### Maintenance — "organize memories"

When the user says "organize memories":
1. Read built-in `MEMORY.md` + 4 feedback files
2. Read global `~/.claude/memory/memory.md` + topic files
3. Skim wiki for stale entries (daily logs older than relevance horizon, decisions still `status/draft`)
4. Promote cross-project gotchas from wiki → global memory
5. Merge / re-sort / dedupe within each layer
6. Show summary of changes

Not a substitute for session-start awareness — that's the SessionStart hook (global) + harness (built-in) + project `CLAUDE.md` pointers (wiki).

## Wiki entry points for project state

When working on M1.5++ or beyond, start with:

- `wiki/projects/narrative-chess-v2.md` — current ship status, branch state, open threads
- `wiki/mocs/decisions.md` — decision index
- `wiki/notes/lesson-*.md` — gotchas captured from prior sessions
- Latest dated file in `docs/superpowers/plans/` — current phase

Auth state, theming, realtime+RLS gate procedure all live as `wiki/notes/*.md`.

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
- **Merge strategy:** feat → `dev` uses `gh pr merge --merge` (i.e. `--no-ff`)
  so the branch fan-out + merge-back arc stays visible in `dev`'s git graph.
  `dev` → `main` uses `gh pr merge --squash` because main's branch protection
  requires linear history. Never `--rebase` (rewrites SHAs of others' commits).
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