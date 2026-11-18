<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Narrative Chess V2

Cursor (`.cursor/rules/`) and Copilot (`.github/copilot-instructions.md`), if added, should defer to this file to avoid drift.

## Where things live

- Wiki: start at `wiki/index.md`; wiki conventions in `wiki/AGENTS.md`.
- Ship status, branch state, open threads: `wiki/projects/narrative-chess-v2.md`
- Decisions: `wiki/notes/decision-*.md`, indexed at `wiki/mocs/decisions.md`
- Lessons from prior sessions: `wiki/notes/lesson-*.md`
- Daily progress: `wiki/daily/YYYY-MM-DD.md`
- Design spec: `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` (latest dated file in `docs/superpowers/specs/` is current)
- Active implementation plan: latest dated file in `docs/superpowers/plans/`
- Auth state, theming, realtime+RLS gate procedure: `wiki/notes/*.md`. Run `wiki/notes/realtime-rls-gate-procedure.md` whenever RLS or the Realtime publication changes.

## Stack pin

Next.js 16.2, React 19, TypeScript, Tailwind v4, shadcn/ui, Supabase JS + SSR, chess.js, Zod.

## Verify framework APIs against shipped docs

Before introducing a Next.js or Supabase pattern not already used in this repo, check it against `node_modules/next/dist/docs/` or the current Supabase docs. Framework versions move faster than any model's knowledge; the repo's existing usage is the first reference.

## File invariants

- DB writes only via Server Actions. Client never imports `service_role` key.
- Migrations only via `supabase migration new <name>`. Never edit a migration after `supabase db push`.
- chess.js imported only in `lib/chess/engine.ts`. Wrap, never spread.
- RLS policies live in the same migration as the table they guard.
- Realtime publication changes always co-located with the relevant table migration.

## What NOT to touch

- `node_modules/` (rebuild from `bun install`)
- Past migrations (write a new one that alters)
- `auth.users` table directly; use `public.profiles` for app data

## Verification commands

- `bun run lint`: ESLint
- `bunx tsc --noEmit`: TypeScript check
- `bunx playwright test`: e2e
- `supabase db lint`: Supabase advisors (when Supabase CLI installed)

## Pulling content from v1

`git clone https://github.com/redlamp/narrative-chess-v1 ../narrative-chess-v1` separately.
Copy needed content by hand. Never auto-import.

## Branches and commits

- Merges use `gh pr merge --merge`. `main`'s "require linear history" protection must be off for this; see wiki daily 2026-09-03.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `ci:`.
- Stage files explicitly by name. Avoid `git add -A` / `git add .` to keep secrets, runtime artifacts and scratch files out.

### When a direct push to `dev` is OK (vs feature branch + PR)

GitHub branch protection on `dev` requires PRs but allows admin bypass (`enforce_admins=false`). The convention is path-based, enforced by us, not by a rule:

| Path / change type | Route |
|---|---|
| `wiki/**` | direct push to `dev` OK |
| `docs/**` (specs, plans) | direct push to `dev` OK |
| `CLAUDE.md`, `AGENTS.md`, `README.md`, `wiki/AGENTS.md` | direct push to `dev` OK |
| Anything in `app/`, `components/`, `lib/`, `supabase/migrations/`, `package.json`, config | feature branch + PR |
| Mixed change touching both | feature branch + PR (treat as code) |

Why: code changes need CI lint+typecheck+e2e gating and a PR review surface; docs and wiki don't ship runtime behavior, so routing them through PRs adds friction without catching anything CI would flag.
