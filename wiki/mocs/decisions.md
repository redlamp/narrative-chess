# MOC — Decisions

Significant project decisions and their rationale. Each entry should link to a `notes/decision-*.md` file with full context.

## Decision Log

### Infrastructure / repo

- [[decision-collapse-memory-to-wiki]] — collapse project `.claude/memory/` into wiki + built-in; PreToolUse → SessionStart hook (2026-05-06)
- [[decision-three-way-info-split]] — `.claude/memory/` vs `wiki/` vs `docs/` (2026-05-02, partially superseded 2026-05-06)
- [[decision-memory-injection-via-hook]] — auto-load memory via PreToolUse hook (2026-05-02, superseded 2026-05-06)
- [[decision-theming]] — shadcn New York + Slate, CSS-var-only (2026-05-02)

### v2 foundation (from 2026-05-02 design audit)

- [[decision-stack-nextjs-16]] — Next.js 16.2 + React 19 + TS + Tailwind v4 + shadcn + Zod
- [[decision-fresh-supabase-project]] — new v2 Supabase project; v1 narrative content exported to JSON first
- [[decision-rpc-move-append]] — move append via Postgres RPC with `expected_ply` optimistic concurrency
- [[decision-supabase-local-dev]] — hosted-first; Docker deferred until trigger condition fires
- [[decision-vercel-default-previews]] — auto-deploy every branch (Vercel default) (2026-05-03, supersedes [[decision-vercel-branch-filter]])
- [[decision-auth-email-password]] — email + password for M1; OAuth deferred to M2+

### Branding / naming

- [[decision-project-name-narrative-chess]] — keep "Narrative Chess" with trade-offs noted; Pawnsong reserved as future strong-brand pivot (2026-05-09)
