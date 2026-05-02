# AGENTS.md

This project's source of truth for AI agents is `CLAUDE.md`. AGENTS.md exists for tools that look here by default (Cursor, Codex, Aider, etc.).

Read in this order:

1. `CLAUDE.md` (project root) — memory rules, AI rails, workspace pointers
2. `wiki/CLAUDE.md` — wiki conventions (decisions, daily logs, MOCs)
3. `.claude/memory/memory.md` — project memory index
4. `~/.claude/memory/memory.md` — global memory index (cross-project user identity, communication preferences)
5. `docs/superpowers/specs/` — design specs (latest dated file is current)
6. `docs/superpowers/plans/` — implementation plans (latest dated file is current)

Both Cursor (via `.cursor/rules/` if present) and Copilot (via `.github/copilot-instructions.md` if present) should defer to `CLAUDE.md` to avoid drift.
