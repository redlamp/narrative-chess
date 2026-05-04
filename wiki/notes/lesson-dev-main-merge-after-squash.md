---
tags:
  - domain/ci-cd
  - status/adopted
  - origin/m1-ship
---

# Lesson — `dev` → `main` Merges After Repeated Squash-Merges

## Setup

Project convention is squash-merge each feat branch into `dev`, then squash-merge `dev` into `main` per phase. After several phases of this pattern, `dev` and `main` have diverged commit histories even though their CONTENT for shipped phases is equivalent.

## Symptom

When opening the `dev` → `main` PR for a milestone ship (e.g., M1):

```
gh pr merge <pr#> --squash
> Pull request is not mergeable: the merge commit cannot be cleanly created.
```

Or via the GitHub UI: the merge button is disabled with "Conflicts must be resolved".

## Cause

Each squash-merge into `main` (one per phase ship) creates a single new commit on `main` that contains all of that phase's diff but has a SHA that does NOT exist on `dev`. Meanwhile `dev` has the original feat-branch commits (different SHAs, same content) plus newer phase commits.

Git's three-way merge tries to find a common ancestor between `dev` and `main`. The common ancestor is far back (before any squash-merges). Files that exist on both branches via different commit-SHAs trigger `add/add` conflicts, even when the content is identical or `dev`'s content is a strict superset of `main`'s.

## Resolution

Locally, on `dev`:

```bash
git fetch origin
git merge origin/main --no-edit
# CONFLICT (add/add): Merge conflict in <file1>
# CONFLICT (add/add): Merge conflict in <file2>
git checkout --ours <file1> <file2> ...   # take dev's version (always the superset)
git add <file1> <file2> ...
git commit --no-edit
git push origin dev
```

Then retry the PR squash-merge. CI re-runs, green, merge succeeds.

## Why "ours" (dev) is always correct

In the squash-merge-only ship pattern, `dev` always contains everything that's on `main` (because each `main` ship was a squash of dev's content) PLUS additional phase work. So whenever Git flags an add/add conflict between `dev` and `main`, `dev`'s version is by definition the more recent, more complete content. `--ours` is the right choice.

If the project ever did hotfix-on-main without back-merging to dev, this assumption breaks. We don't, so it doesn't.

## Tradeoff

The merge commit on `dev` (`Merge remote-tracking branch 'origin/main' into dev`) is a one-time linearity break in `dev`'s history. `main` itself stays linear: every commit on `main` is a single squash. We accepted this tradeoff during M1 ship; revisit if it becomes painful at M2 ship time.

## Alternatives considered

- **Rebase `dev` onto `main`** before opening the ship PR. Replays dev's commits atop main's tip. Cleaner local history but changes existing SHAs on a shared protected branch — risky if anyone else has a working tree pointing at those commits.
- **Force-push `main` to match `dev`'s tip.** Flat replacement. Drops `main`'s squash-commit history. Required disabling branch protection. Rejected as too destructive.
- **Stop squash-merging to `dev`** and use plain merges instead. Would eliminate the divergence at the cost of a noisier `dev` log. Future option; not retrofitting.

## Source

Encountered during M1 ship, 2026-05-03. PR #12 first failed to merge cleanly; resolved by merging `origin/main` into `dev` locally with `git checkout --ours` for the four conflicting files (`app/games/[gameId]/actions.ts`, `lib/chess/engine.test.ts`, `lib/chess/engine.ts`, `lib/schemas/move.ts`), pushing the reconciliation commit, then squash-merging PR #12 successfully.
