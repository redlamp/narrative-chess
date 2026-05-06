---
tags:
  - domain/memory
  - status/adopted
  - scope/foundation
---

# Decision — Collapse Project Memory Layer Into Wiki + Built-In

**Date:** 2026-05-06
**Status:** Adopted
**Supersedes:** [[decision-three-way-info-split]] (partially), [[decision-memory-injection-via-hook]] (PreToolUse → SessionStart)

## Context

Three auto-context layers coexisted: Claude built-in per-project memory (`~/.claude/projects/<mapped>/memory/`, harness-injected at session start), user-built project memory (`.claude/memory/`, hook-injected), user-built global memory (`~/.claude/memory/`, hook-injected). Plus the wiki.

Confirmed in a 2026-05-06 audit session:

- Built-in `MEMORY.md` and project memory `memory.md` both held project state in different schemas — duplicate work
- `user_role.md` (built-in) was 91 lines and duplicated `wiki/projects/narrative-chess-v2.md` Status section
- Project memory schema (topic-aggregated `general.md` + `domain/*.md`) and built-in schema (atomic file-per-fact + frontmatter) gave conflicting save instructions
- PreToolUse hook re-injected ~200 lines per session, much of it already in the system prompt
- Wiki is preferred for project state — Obsidian-navigable, human-readable, three-way split intent in [[decision-three-way-info-split]] said "wiki for decisions, daily logs, half-formed thoughts" anyway

## Choice

Collapse to **two project layers + one global layer + wiki**:

| Layer | Path | Purpose | Auto-load |
|---|---|---|---|
| Built-in (harness) | `~/.claude/projects/<mapped>/memory/` | Atomic feedback rules + identity (4 `feedback_*.md` files only) | Yes — system prompt |
| Global memory | `~/.claude/memory/` | Cross-project tool gotchas (Supabase CLI Windows, react-19-lint patterns, etc.) | Yes — SessionStart hook |
| Wiki | `wiki/` | Project state, decisions, research, daily logs (this knowledge graph) | No — read on demand |
| ~~Project `.claude/memory/`~~ | — | **Deleted.** | — |

## What changed

1. **Project memory dir deleted** — `general.md` Ship facts, `domain/theming.md`, `domain/auth.md` content migrated to wiki (this note's siblings: [[decision-theming]], [[decision-auth-email-password]], [[narrative-chess-v2]] Status section)
2. **Built-in `MEMORY.md` trimmed** — points only to 4 `feedback_*.md` rules
3. **`user_role.md` deleted** — content already in wiki + project CLAUDE.md
4. **PreToolUse hook → SessionStart hook** — fires once per session instead of before every tool call. Injects only `~/.claude/memory/memory.md` (no project layer to inject)
5. **CLAUDE.md files updated** — drop project memory sections + Repo Memory Auto-Init; Global Memory section references SessionStart hook

## Why

- Single source of truth for project state (wiki); single source for cross-cutting rules (built-in)
- Built-in's strength is harness-guaranteed auto-load — perfect for atomic feedback rules I need every turn
- Wiki's strength is human navigation + decision rationale — perfect for what's left
- Global memory still earns its keep for tool gotchas that span projects (no single project's wiki should hold them)
- ~150-200 lines less injected into context per session (no more PreToolUse duplicate)

## Tradeoff accepted

- Project state in wiki is read-on-demand, not auto-injected. Mitigated by project `CLAUDE.md` pointing to `wiki/projects/narrative-chess-v2.md` for ship status when relevant.
- "Organize memories" trigger remains for maintenance but is **not** a substitute for session-start awareness — that's the SessionStart hook (global) + harness (built-in) + CLAUDE.md pointers (wiki).

## Risks

- Migration loss if wiki absorption was incomplete. Mitigation: lessons + decision notes verified before deleting source files.
- Compliance gap on wiki reads if project CLAUDE.md pointer is too soft. Mitigation: revisit after first smoke session.
- Hook revert path: old `pre-tool-memory.{py,sh}` kept on disk for one cycle; restoring is a `settings.json` swap.

## See also

- [[decision-three-way-info-split]] — original three-way split, now collapsed to two-way for project layer
- [[decision-memory-injection-via-hook]] — original PreToolUse hook design, superseded by SessionStart variant
- [[mocs/decisions]]
- Plan file: `~/.claude/plans/what-if-we-remove-generic-anchor.md`
