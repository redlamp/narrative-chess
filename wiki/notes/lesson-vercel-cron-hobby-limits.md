---
tags:
  - domain/vercel
  - status/adopted
  - scope/m1
---

# Lesson — Vercel Cron Hobby Tier Limits

**Date learned:** 2026-05-05 (M1.5++ session)

## Limits

- **2 cron jobs max** per project on Hobby
- **Hourly minimum** schedule — sub-hourly schedules (`*/5 * * * *` etc.) are paid-tier only
- Cron payload arrives via standard Vercel Function — auth via shared secret in `Authorization: Bearer $CRON_SECRET` header

## Implication for clocks/timeout design

Lazy detection inside RPCs (`make_move`, `claim_timeout`) catches the common case — at least one client is watching. Cron sweep is for the abandoned-by-both-sides case only.

Daily 04:00 UTC chosen for `/api/cron/timeout-sweep` — burns 1 of the 2 free slots; leaves 1 for future use.

## Setup notes

- `vercel.json` `crons[]` entry defines the schedule
- `CRON_SECRET` set in Vercel envs (Production + Preview/dev) — encrypted at rest
- Verify with: `curl https://<host>/api/cron/timeout-sweep -H "Authorization: Bearer $CRON_SECRET"`

## See also

- `app/api/cron/timeout-sweep/route.ts`
- `vercel.json` crons section
- Spec: `docs/superpowers/specs/2026-05-05-clocks-timeout-reconnect-design.md`
