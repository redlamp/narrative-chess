---
tags:
  - domain/ci-cd
  - status/adopted
---

# Lesson — Husky Pre-Commit Fragility on Windows MINGW Worktrees

**Date learned:** 2026-05-04 (M1.5+ session, fixed in PR #24)

## Symptom

Fresh `git worktree` checkout on Windows fails the pre-commit hook with:

```
Exec format error
```

Main worktree commits fine. New worktrees break.

## Root cause

`.husky/pre-commit` originally had **no shebang + CRLF line endings**. Main worktree happens to work because `core.hooksPath = .husky/_` (husky 9 dispatcher dir) resolves the script via the dispatcher, which tolerates the missing shebang. Fresh worktrees inherit a different hooksPath config and try to exec the user-level hook directly → MINGW can't parse a shebang-less + CRLF script.

## Fix (shipped in PR #24)

1. Add `#!/bin/sh` as the first line of `.husky/pre-commit`
2. Pin LF line endings via `.gitattributes` (`.husky/* text eol=lf`)
3. Re-save existing hook with LF

Alternative (per-worktree, brittle): `git config core.hooksPath .husky/_` after each `git worktree add`.

## Why this matters

Worktrees are the cleanest way to do isolated feature work without touching the main checkout. Hook fragility makes them feel broken.

## See also

- PR #24 — chore(husky): pre-commit shebang + LF eol
- `.husky/pre-commit`, `.gitattributes`
