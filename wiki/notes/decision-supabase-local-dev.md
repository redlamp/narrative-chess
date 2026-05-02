# Decision — Supabase Local Dev Deferred (Hosted-First)

**Date:** 2026-05-02
**Status:** Adopted (hybrid posture)

## Context

Supabase ships a local stack via Docker (`supabase start` boots Postgres + Auth + Realtime + Studio + Inbucket on `localhost:54321-54324`). The CLI also operates fine in hosted-only mode against a live remote project.

Question for v2: install Docker Desktop and adopt the local stack now, or defer.

The user is a UX designer who is semi-technical and learning Supabase from scratch. Activation cost matters.

## Options considered

1. **A. Required from day one**: install Docker Desktop, all dev hits localhost
2. **B. Hosted-first, never local**: skip Docker entirely
3. **C. Hybrid, deferred** (chosen): hosted-first now; install Docker when complexity justifies

## Choice

Hosted-first for now. Add Docker when ANY of the following triggers:

- First non-trivial RLS policy that needs two-user verification without polluting hosted DB
- First migration that breaks something and a `supabase db reset` would have saved 30+ minutes of restore-from-backup
- First time another collaborator joins the project (one-command spin-up wins)
- First incident where prod state had to be untangled by hand

Document trigger event in this note when it happens.

## Why

- Migration files are plain timestamped SQL. Same files work locally or against hosted — no rework cost when switching
- `supabase link --project-ref <ref>` already needed for hosted-only flow; no reconfiguration to add Docker later
- Supabase free tier (500 MB DB, 5 GB bandwidth) easily accommodates dev volume for 2 test users
- Lower learning curve early: 4 commands (`supabase login`, `supabase init`, `supabase migration new`, `supabase db push`) vs the full local-stack toolset
- App code reads env vars; switching to local = changing `.env.local` URLs, no code change

## Risks / follow-ups

- A bad migration on hosted = restore from backup (Supabase free tier: 1 day retention). Acceptable for solo dev with 2 test users; would not be acceptable with real data.
- RLS policy errors on hosted are recoverable (drop + recreate policy) but visible in production — small embarrassment cost, no real harm in M1 dev phase.
- Trigger to revisit: first time the user (or Claude) hits "I broke something I can't easily roll back" — install Docker that day.

## When trigger fires (procedure)

1. Install Docker Desktop for Windows (~10 min)
2. `cd narrative-chess-v2 && supabase start` — boots local stack
3. `supabase db reset` — applies all migrations to local DB
4. Use a separate `.env.local.docker` or update `.env.local` with `localhost` URLs
5. Push migration workflow becomes: `supabase migration new <name>` → edit → `supabase db reset` → test locally → `supabase db push` to remote

Estimated total time when trigger fires: 30 minutes. No code changes required.

## See also

- [[mocs/decisions]]
- [[mocs/architecture]]
- `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` §4, §7 Step H
- Supabase local dev: https://supabase.com/docs/guides/cli/local-development
