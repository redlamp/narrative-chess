# Narrative Chess V2

Rewrite of [[narrative-chess-v1]]. Chess-first rebuild with narrative layer, designed AI-collaboration-friendly from day one.

## Status

- Started: 2026-05-02
- Phase: scaffolding (repo conventions, memory, wiki, hooks)
- Stack: TBD (likely Next.js + Supabase per v1 plan)

## Goals

(Fill in: what this version must do, what failed in v1, what success looks like)

## Constraints

(Fill in: time, budget, platform, performance targets)

## Key decisions

- [[decision-three-way-info-split]] — `.claude/memory/` vs `wiki/` vs `docs/`
- [[decision-memory-injection-via-hook]] — auto-load memory via PreToolUse hook

## Open threads

- Stack confirmation (Next.js + Supabase from v1 plan vs reconsider)
- Repo init — `git init` + first commit pending
- v1 lessons audit — what to keep, what to discard

## Related

- [[narrative-chess-v1]] — predecessor (no wiki note yet, lives in `~/.claude/projects/C--workspace-narrative-chess-v1/`)
- [[mocs/architecture]]
- [[mocs/decisions]]
- [[mocs/game-design]]
