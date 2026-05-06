---
tags:
  - domain/vercel
  - status/adopted
  - origin/v1-failure
---

# Lesson — Gate Dev-Only UI on `VERCEL_ENV`, Not `NODE_ENV`

**Date learned:** 2026-05-04 (M1.5+ session)

## What

`process.env.NODE_ENV !== "production"` hides UI from preview builds — exactly where smoke testing wants it visible. On Vercel **both preview AND production builds set `NODE_ENV=production`**.

## Fix

Use `process.env.VERCEL_ENV !== "production"` instead. Surface to client via `next.config.ts`:

```ts
env: {
  NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "development",
}
```

Next inlines `NEXT_PUBLIC_*` at build time → gate stays statically replaceable + dead-code-eliminates in production builds.

## Visibility matrix

| Build | `VERCEL_ENV` | Dev-only UI |
|---|---|---|
| `bun run dev` (localhost) | `"development"` | visible |
| Vercel preview build | `"preview"` | visible |
| Vercel production build | `"production"` | hidden + DCE'd |

## Why this matters

Smoke-test affordances (e.g., dev-only "fool's mate" button shipped in PR #22) need to be visible in preview builds without leaking to production. `NODE_ENV` alone can't distinguish the two on Vercel.

## See also

- `next.config.ts` — `NEXT_PUBLIC_VERCEL_ENV` export
- PR #22 — fool's mate dev affordance
- [[decision-vercel-default-previews]]
