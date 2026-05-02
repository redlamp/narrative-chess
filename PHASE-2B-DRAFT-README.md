# Phase 2B Code Draft — Read Before Merging

This branch (`feat/phase-2b-code-draft`) pre-stages Phase 2B code that doesn't depend on Phase 1 scaffold being run yet. **This branch will NOT compile on its own** — imports like `@supabase/ssr`, `next/server`, `next/headers`, and `zod` aren't installed because `bun install` hasn't run yet.

## What's here

| File | Purpose |
|---|---|
| `lib/env.ts` | Zod-validated env vars, server/client variants |
| `lib/supabase/client.ts` | Browser Supabase client (`@supabase/ssr` `createBrowserClient`) |
| `lib/supabase/server.ts` | Server Supabase client (cookies-aware) |
| `lib/supabase/middleware.ts` | Session refresh helper |
| `middleware.ts` | Root Next.js middleware that calls `updateSession` |
| `.env.local.example` | Template for local Supabase env vars |
| `supabase/migrations/20260502120000_init_profiles.sql` | Profiles table + auto-create trigger + updated_at trigger |

## Files NOT staged (intentionally — would conflict with `bun create next-app`)

- `app/**` — sign-up page, login page, logout route handler, auth-aware landing page. Phase 2 plan Tasks 15-18.
- `app/diagnostics/realtime/` — gate diagnostic UI. Phase 3 plan Task 5.

These wait until scaffold ships, then get added on a branch off `feat/scaffold-next` per the plans.

## How to merge

After Phase 1 scaffold completes (Phase 1 plan Tasks 3-10 produce `feat/scaffold-next`):

```bash
git checkout feat/scaffold-next
git merge feat/phase-2b-code-draft

# Then `bun install` resolves the imports (deps already in package.json)
bun install
bunx tsc --noEmit  # should pass
bun run lint       # should pass
```

If conflicts: scaffold doesn't write to `lib/`, `middleware.ts`, `.env.local.example`, or `supabase/`, so conflicts are unlikely. Most probable conflict: `.gitignore` (resolved per Phase 1 plan Task 5).

## Migration timestamp note

`20260502120000_init_profiles.sql` uses a hardcoded timestamp (May 2 2026 at 12:00 UTC). Future migrations created via `supabase migration new <name>` will use wall-clock time after this point, so they sort correctly. If you create another migration via the CLI before merging this branch, your generated timestamp will be later than `20260502120000` — fine; ordering preserved.

If you want to "convert" this to a real CLI-managed migration, you can:
1. Run `supabase init` (creates `supabase/config.toml`)
2. The timestamped file is already in `supabase/migrations/`, so it'll be picked up by `supabase db push` automatically

## Delete this README before merging to dev

This README is just for branch-review hand-off context. Once the branch merges into `feat/scaffold-next` (or directly into `dev` after `bun install` resolves imports), delete this file:

```bash
rm PHASE-2B-DRAFT-README.md
```
