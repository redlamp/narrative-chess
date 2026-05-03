---
tags:
  - domain/memory
  - status/adopted
  - scope/foundation
---

# Decision — Memory Injection via PreToolUse Hook

**Date:** 2026-05-02
**Status:** Adopted

## Context

`MEMORY.md` files are useless if Claude doesn't read them. Relying on the model to remember to read memory at session start is unreliable — it skips the read when the user's first prompt is task-focused.

## Options considered

1. Add "read memory first" instruction to CLAUDE.md and hope the model complies
2. Manually paste memory at session start
3. **PreToolUse hook auto-injects memory** (chosen)

## Choice

Register a `PreToolUse` hook in `~/.claude/settings.json` that runs `~/.claude/hooks/pre-tool-memory.sh` before every tool call. Hook reads stdin payload, dedups via `session_id`, and on first call per session emits `hookSpecificOutput.additionalContext` containing:

1. Session-storage `MEMORY.md` (Claude's auto-managed per-project memory)
2. Workspace `.claude/memory/memory.md` (this project's local index)
3. Global `~/.claude/memory/memory.md` (cross-project index)

Subsequent calls within same session: silent exit (flag file at `~/.claude/cache/memory-loaded-{session_id}`).

## Why

- Deterministic: model never forgets to load memory
- Cheap: ~150ms once per session, 0 thereafter
- Subagent-aware: each subagent has its own session_id → re-injects
- Silent on failure: hook exits 0 with no stdout if anything goes wrong, tool calls still succeed

## Adaptations from original spec

- Spec used `python3` shebang; Windows machine has only `python` → switched
- Spec used `/tmp/...` flag file; Windows-native Python resolves `/tmp` differently than git-bash → moved to `~/.claude/cache/...`
- Spec read only session-storage memory; expanded to also read workspace `.claude/memory/memory.md`
- Spec used PPID for dedup; PPID unstable across hook invocations on Windows → switched to `session_id` from stdin payload

## Risks / follow-ups

- Flag files accumulate in `~/.claude/cache/` (one per Claude Code session ever run, 0 bytes each). Periodic cleanup not yet scheduled.
- If `python` leaves PATH, hook silent-fails — tool calls still work but no memory injection. No alert.
- Subagents always re-inject — could be wasteful for cheap subagents. Acceptable trade.

## See also

- [[mocs/decisions]]
- `~/.claude/hooks/pre-tool-memory.py` — implementation
- `~/.claude/hooks/pre-tool-memory.sh` — wrapper
