---
tags:
  - domain/vercel
  - domain/ci-cd
  - domain/auth
  - status/adopted
  - scope/foundation
---

# Decision — Vercel Default Previews (Auto-Deploy Every Branch)

**Date:** 2026-05-03
**Status:** Adopted
**Supersedes:** [[decision-vercel-branch-filter]]

## Context

Original decision (2026-05-02) restricted Vercel auto-deploy to `main` + `dev` only via `vercel.json` `git.deploymentEnabled` + `ignoreCommand`. Rationale: dashboard tidiness, tighter Supabase auth allow list, lower build-minute consumption.

Two-day reality check (2026-05-03): user wanted to phone-test current Phase 6 work. No preview existed for `feat/phase-6-game-end-states` because of the filter. Manual `vercel` CLI per branch is friction; defeats the point of preview-per-commit.

## Options reconsidered

1. **A. Default Vercel behavior** — preview-per-branch on every push. Stable URL pattern per branch slug. (chosen)
2. B. Filter to `feat/*` + `main` + `dev` — half-measure, still drops PR-driven branches with other prefixes
3. C. Single canonical staging alias, manually repointed via `vercel alias` — adds repoint step before each test session
4. D. Original filter (main + dev only) — superseded

## Choice

Default Vercel behavior. `vercel.json` shrunk to just `$schema`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json"
}
```

Every push to every branch → preview deploy at predictable URL:
- Branch URL: `https://narrative-chess-git-<branch-slug>-taylor-8571s-projects.vercel.app` (stable per branch, latest commit)
- Per-commit URL: `https://narrative-chess-<7char-sha>-taylor-8571s-projects.vercel.app` (immutable)
- Production: `https://narrative-chess.vercel.app` (`main` only)

## Why

- **Default exists for a reason.** Vercel built preview-per-branch as the prototyping workflow — it's the single biggest reason teams pick Vercel over plain hosting. Opting out forfeits the benefit without a strong counter-reason.
- **Solo dev on Hobby has unbounded deploy count + 6000 build min/mo.** Build-minute concern was hypothetical; current burn rate is ~1 min/deploy.
- **Phone testing requires a hosted URL.** Local `bun run dev` doesn't reach the phone without ngrok/tailscale gymnastics. Preview URL is the easy path.
- **PR-driven workflow benefits from auto-comment bot.** GitHub PR shows latest preview URL inline — no link-tracking burden.
- **URL sprawl is solvable** without filtering: bookmark the branch URL (stable across commits on that branch), use Vercel mobile app for deploy notifications, or pin one PR per active feature.

## Trade-offs accepted

- **Supabase Auth allow list needs a wildcard.** Currently lists exact preview URLs; new branch slugs won't match. Add wildcard entry: `https://narrative-chess-git-*-taylor-8571s-projects.vercel.app/**`. See follow-ups.
- **Dashboard clutter.** Vercel groups by branch, so manageable, but old feat-branch deployments accumulate. Periodic prune via `vercel rm` or dashboard.
- **Build minutes consumed on WIP pushes.** Acceptable on Hobby; revisit if approaching cap.
- **Deployment Protection (Vercel SSO) gates phone access.** Either log in to Vercel mobile, disable protection for previews, or accept the SSO step.

## Follow-ups

- [ ] Update Supabase Auth dashboard → URL Configuration → Redirect URLs: add `https://narrative-chess-git-*-taylor-8571s-projects.vercel.app/**` wildcard. Without this, OAuth/magic-link/password-reset flows from non-`dev` branch previews will fail.
- [ ] Update `.claude/memory/domain/auth.md` allow list section once wildcard is added.
- [ ] Consider toggling Deployment Protection off for non-prod environments if phone SSO friction persists.
- [ ] Periodic `vercel ls` + prune of stale branch deployments (or set retention policy if Vercel adds one).

## See also

- [[decision-vercel-branch-filter]] (superseded)
- [[mocs/decisions]]
- Vercel branch deployment config: https://vercel.com/docs/deployments/preview-deployments
