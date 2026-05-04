---
tags:
  - domain/vercel
  - domain/ci-cd
  - domain/auth
  - status/superseded
  - scope/foundation
---

# Decision — Vercel Branch Filter (Auto-Deploy main + dev Only)

**Date:** 2026-05-02
**Status:** Superseded 2026-05-03 by [[decision-vercel-default-previews]]

## Context

Vercel Hobby tier auto-deploys every push to every branch by default. For a solo dev with active feat-branch workflow, that creates:

- Dashboard clutter (every WIP push shows up as a deployment)
- Auth complexity (every preview URL = a unique subdomain that Supabase Auth must whitelist for redirects, or wildcard the allow list)
- Build-minute consumption (Hobby: 6000 min/mo — fine, but unnecessary)

Hobby tier limits: no cap on deployment count, but 100 GB bandwidth, 6000 build min/mo, 1 concurrent build, deployments retained ~indefinitely until manually deleted.

## Options considered

1. **A. Branch filter via `vercel.json`**: auto-deploy only `main` + `dev`. feat branches run locally or manual `vercel` CLI. (chosen)
2. B. Stable preview alias: deploy everything but pin one URL (`dev-narrative-chess.vercel.app`) to `dev` branch
3. C. PR-label gating: GH Action triggers Vercel deploy only when PR has `deploy-preview` label
4. D. Default behavior: every push deploys

## Choice

`vercel.json` at repo root:

```json
{
  "git": {
    "deploymentEnabled": {
      "main": true,
      "dev": true
    }
  },
  "ignoreCommand": "if [ \"$VERCEL_GIT_COMMIT_REF\" = \"main\" ] || [ \"$VERCEL_GIT_COMMIT_REF\" = \"dev\" ]; then exit 1; else exit 0; fi"
}
```

**Verified 2026-05-02:** `git.deploymentEnabled` alone did NOT prevent preview deploys on unlisted branches in the Hobby tier — pushing a `test/no-deploy` branch still triggered a preview build. Added `ignoreCommand` as defense-in-depth: any branch other than `main` or `dev` exits 0 (skip build) before container resources spin up. ignoreCommand is the source of truth for the filter; `deploymentEnabled` retained for clarity.

Plus: in Vercel dashboard → Domains, add custom alias `dev-narrative-chess.vercel.app` tracking `dev` branch. Note hyphen, not subdomain — Vercel free tier doesn't allow custom subdomains on `.vercel.app`. If that exact name is taken, use `narrative-chess-dev.vercel.app` or another flat alias.

Net result:
- `narrative-chess.vercel.app` (production) → `main`
- `dev-narrative-chess.vercel.app` (preview) → `dev`
- feat branches → no auto-deploy. Local `bun run dev` for active iteration; manual `vercel` CLI when a hosted preview is needed.

## Why

- Two stable URLs are bookmark-friendly and shareable
- Supabase Auth allow list stays tight: only `narrative-chess.vercel.app`, `dev-narrative-chess.vercel.app`, `localhost:3000`. No wildcard needed.
- feat-branch WIP doesn't spam deployment history
- Consumes fewer build minutes (margin, not bottleneck — but tidier)
- Approach B (stable alias) was tempting but doesn't reduce build count; only addresses URL stability

## Risks / follow-ups

- Loss of automatic preview-per-PR. If a future collaborator wants to review a feat branch hosted, the branch owner runs `vercel` from their checkout to push a one-off preview. Acceptable for solo dev; revisit if team grows.
- If `dev` ever drifts from `main` for long, the `dev` preview URL becomes the de facto demo URL. Watch that `dev` doesn't go stale.

## See also

- [[mocs/decisions]]
- [[mocs/architecture]]
- `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` §4, §7 Step F
- Vercel branch deployment config: https://vercel.com/docs/deployments/preview-deployments
