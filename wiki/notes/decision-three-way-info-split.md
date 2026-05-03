---
tags:
  - domain/memory
  - status/adopted
  - scope/foundation
---

# Decision — Three-Way Info Split

**Date:** 2026-05-02
**Status:** Adopted

## Context

Project info naturally splits into different audiences and lifecycles. Lumping everything into one location (`docs/` or one big `MEMORY.md`) makes it hard for AI to inject the right slice into context, and hard for humans to find the right slice when working.

## Options considered

1. Single `docs/` folder with everything
2. `docs/` + ad-hoc `MEMORY.md` files
3. **Three-way split** (chosen)

## Choice

Three folders, three audiences:

| Location | Audience | Contents |
|---|---|---|
| `.claude/memory/` | Claude (auto-injected via hook) | preferences, conventions, identity, tool configs, domain crib-sheets |
| `wiki/` | Human (Obsidian vault) | decisions, research, daily logs, people, projects, half-formed thoughts |
| `docs/` | Public / formal | PRDs, specs, ADRs in long form, READMEs |

## Why

- Claude's context budget is limited — only inject what AI needs (memory/), not the entire knowledge graph
- Wiki is for thinking-in-public-with-self — different from polished docs
- Docs is for artefacts that ship or get linked from outside the codebase

## When unsure

Half-formed → wiki. AI-facts → memory. Formal/public → docs.

## See also

- [[mocs/decisions]]
- `wiki/CLAUDE.md` — write-policy that Claude follows
