# MOC — Lessons

Lessons learned from shipping work. Cross-project gotchas live in `~/.claude/memory/tools/` instead and the wiki note becomes the project-context companion.

## Toolchain + platform

- [[lesson-dev-main-merge-after-squash]] — squash-PR back-merge drift; resolve with `git merge origin/main` + `--ours`. (cross-project: `~/.claude/memory/tools/git-squash-divergence.md`)
- [[lesson-husky-pre-commit-windows-worktree]] — Husky "Exec format error" on MINGW worktrees. (cross-project: `~/.claude/memory/tools/husky-windows-worktree.md`)
- [[lesson-vercel-cron-hobby-limits]] — Vercel Hobby tier cron limits: 2 jobs max, hourly minimum, Bearer auth. (cross-project: `~/.claude/memory/tools/vercel-cron-hobby-limits.md`)
- [[lesson-vercel-preview-vercel-env-not-node-env]] — gate dev-only UI on VERCEL_ENV, not NODE_ENV. (cross-project: `~/.claude/memory/tools/vercel-env-vs-node-env.md`)

## Supabase + database

- [[lesson-postgres-function-signature-drop]] — drop old function signature before changing arg list. (cross-project: `~/.claude/memory/tools/postgres-function-overloading.md`)
- [[lesson-realtime-auth-before-subscribe]] — postgres_changes silently denies under RLS if `setAuth` doesn't resolve before `subscribe`. (cross-project: `~/.claude/memory/tools/supabase-realtime-postgres-changes.md`)

## Frontend + rendering

- [[lesson-webgl-strict-mode-context-loss]] — React StrictMode + R3F dispose the WebGL context on dev double-mount. (cross-project: `~/.claude/memory/tools/r3f-strict-mode-context-loss.md`)

## Realtime / phase work (historical)

- [[phase-5-followups]] — all items resolved 2026-05-03; kept as the trail for board + realtime + observer-mode work.

## See also

- [[mocs/decisions]] — significant decisions + rationale (lessons inform decisions)
- `~/.claude/memory/memory.md` — global cross-project memory index (auto-loaded each session)
