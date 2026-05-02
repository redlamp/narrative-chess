# V2 Phase 2 — Supabase Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a fresh Supabase project for v2, archive v1's narrative content, wire `@supabase/ssr` cookie auth, and ship sign-up + login pages that prove a user can authenticate end-to-end.

**Architecture:** v1 Supabase project is read-only sourced for narrative JSON exports, then paused. New v2 project owns chess auth. `@supabase/ssr` runs three Supabase clients (browser / server / middleware) so the same session works across Server Components, Server Actions, and Realtime channels. A Postgres trigger auto-creates `profiles` rows on `auth.users` insert, removing app-level race conditions.

**Tech Stack:** Supabase (Auth + Postgres + Realtime), `@supabase/ssr`, `@supabase/supabase-js`, Next.js 16.2 (App Router middleware + Server Components), Zod for env-var validation.

**Spec reference:** `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` Steps G + H. This plan implements those two steps in detail.

**Prerequisites (Phase 1 must be done):** scaffold complete; `@supabase/supabase-js`, `@supabase/ssr`, `zod` installed; Vercel project linked; CI green.

**Working branches:**
- `feat/phase-2a-content-export` for Tasks 1-5 (spec Step G) — **DONE 2026-05-02 evening, merged to dev as `7779aa5`**
- `feat/phase-2b-supabase-auth` for Tasks 6-26 (spec Step H) — **partially pre-staged on `feat/phase-2b-code-draft` (NOT merged); rest needs user attendance**

Two branches because Step G can ship independently (just adds files; touches no app code) and merging it first reduces blast radius if Step H needs rework.

## Status as of 2026-05-02 EOD

| Task | Status | Notes |
|---|---|---|
| 1-5 (Phase 2A export) | **DONE** | Merged to dev. Branch `feat/phase-2a-content-export` persists on remote pending cleanup. |
| 6 (pause v1 project) | **DONE** | Paused via Supabase MCP `pause_project`. Status `PAUSING` → `PAUSED`. Restore via dashboard if needed. |
| 7 (create v2 SB project) | PENDING | Needs user — dashboard work; cost-conscious flag respected; free tier slot needed. |
| 8 (env vars in Vercel) | PENDING | Needs Task 7 first. |
| 9 (`supabase init` + `link`) | PENDING | Needs `supabase login` (browser OAuth on user machine). |
| 10 (init_profiles migration) | **PRE-STAGED** | SQL drafted on `feat/phase-2b-code-draft` at `supabase/migrations/20260502120000_init_profiles.sql`. Awaits `supabase db push` after Task 9. |
| 11 (lib/env.ts) | **PRE-STAGED** | On `feat/phase-2b-code-draft`. |
| 12-14 (Supabase clients + middleware) | **PRE-STAGED** | On `feat/phase-2b-code-draft`. |
| 15-18 (auth pages, logout, landing) | PENDING | Skipped pre-stage to avoid conflict with `bun create next-app` output. Add on a sub-branch off `feat/scaffold-next` after scaffold ships. |
| 19 (manual auth flow verify) | PENDING | Needs Tasks 7-18 first. |
| 20 (redirect URL allow list) | PENDING | Dashboard work. |
| 21 (smoke test on dev preview) | PENDING | Needs Tasks 19-20 first. |

**Pickup order when user returns:** Phase 1 scaffold first → merge `feat/conventions-stage` and `feat/phase-2b-code-draft` into `feat/scaffold-next` → continue Phase 1 → then Phase 2 Tasks 7+ (start with creating v2 Supabase project).



---

## Phase 2A — Export v1 narrative content + pause v1 project

### Task 1: Branch off `dev`

**Files:** none (git only)

- [ ] **Step 1: Pull latest dev and branch**

```bash
cd C:/workspace/narrative-chess-v2
git checkout dev
git pull
git checkout -b feat/phase-2a-content-export
```

Expected: switched to new branch.

### Task 2: Create archive folder + .gitkeep

**Files:**
- Create: `content/v1-narrative-archive/.gitkeep`
- Create: `content/v1-narrative-archive/README.md`

- [ ] **Step 1: Create folder + .gitkeep**

```bash
mkdir -p content/v1-narrative-archive
echo "" > content/v1-narrative-archive/.gitkeep
```

- [ ] **Step 2: Write archive README**

Write `content/v1-narrative-archive/README.md`:

```markdown
# v1 Narrative Archive

Snapshot of narrative content from v1 Supabase project (`iwfjbjukqljkrqwibglp`) exported on 2026-05-02 before v2 Supabase project was created.

## Files

- `cities.json` — `public.cities` rows
- `city_editions.json` — `public.city_editions` rows
- `city_versions.json` — `public.city_versions` rows (the substantive narrative payloads, ~33 KB each)

## Why archived

v1 schema coupled chess (`game_threads`) to narrative (`city_editions` FK). v2 starts with a chess-only schema; narrative comes M2+. When narrative layer returns, content here is the seed data — re-import into v2's schema (which will be designed narrative-on-top-of-chess, not the inverse).

## Provenance

Source: v1 Supabase project, public schema, audited via Supabase MCP `list_tables` + `execute_sql`.

Exported via Supabase MCP `execute_sql` calls during Phase 2 work (see `docs/superpowers/plans/2026-05-02-v2-phase-2-supabase-foundation.md`). Raw JSON dumped from `select row_to_json(t) from t;` queries against each table.

After export verified, v1 Supabase project was paused (Settings → Pause project) on 2026-05-02. Resume in dashboard if more inspection needed.
```

- [ ] **Step 3: Commit folder skeleton**

```bash
git add content/v1-narrative-archive/.gitkeep content/v1-narrative-archive/README.md
git commit -m "chore: add content/v1-narrative-archive folder + provenance README"
```

### Task 3: Export `public.cities` rows

**Files:**
- Create: `content/v1-narrative-archive/cities.json`

- [ ] **Step 1: Use Supabase MCP execute_sql to fetch rows**

Run this SQL against project `iwfjbjukqljkrqwibglp` (via the agent's Supabase MCP `execute_sql` tool, not via psql):

```sql
select jsonb_agg(row_to_json(c) order by c.created_at) as data
from public.cities c;
```

- [ ] **Step 2: Save the returned JSON to file**

Take the `data` field of the result (it will be a JSON array). Pretty-print with 2-space indent and write to `content/v1-narrative-archive/cities.json`. Resulting file shape:

```json
[
  {
    "id": "<text>",
    "slug": "edinburgh",
    "name": "Edinburgh",
    "country": "Scotland, United Kingdom",
    "created_at": "...",
    "updated_at": "..."
  }
]
```

- [ ] **Step 3: Verify**

```bash
cat content/v1-narrative-archive/cities.json | head -20
```

Expected: valid JSON array with 1 row (Edinburgh).

### Task 4: Export `public.city_editions` and `public.city_versions`

**Files:**
- Create: `content/v1-narrative-archive/city_editions.json`
- Create: `content/v1-narrative-archive/city_versions.json`

- [ ] **Step 1: Export city_editions**

SQL via Supabase MCP `execute_sql`:

```sql
select jsonb_agg(row_to_json(ce) order by ce.created_at) as data
from public.city_editions ce;
```

Save returned `data` to `content/v1-narrative-archive/city_editions.json`.

- [ ] **Step 2: Export city_versions**

SQL via Supabase MCP `execute_sql`:

```sql
select jsonb_agg(row_to_json(cv) order by cv.city_edition_id, cv.version_number) as data
from public.city_versions cv;
```

Save returned `data` to `content/v1-narrative-archive/city_versions.json`. Expected ~133 KB total (4 rows × ~33 KB each).

- [ ] **Step 3: Verify both files**

```bash
ls -lh content/v1-narrative-archive/*.json
```

Expected: `cities.json` small (~300 bytes), `city_editions.json` small, `city_versions.json` ~130-150 KB.

```bash
bunx tsx -e "console.log(JSON.parse(require('fs').readFileSync('content/v1-narrative-archive/city_versions.json','utf8')).length, 'rows')"
```

(Or use `node -e ...` if tsx not installed.) Expected: `4 rows`.

### Task 5: Commit exports + merge Phase 2A

**Files:**
- Modify: git index (commit + PR)

- [ ] **Step 1: Commit JSON exports**

```bash
git add content/v1-narrative-archive/cities.json content/v1-narrative-archive/city_editions.json content/v1-narrative-archive/city_versions.json
git commit -m "$(cat <<'EOF'
chore: archive v1 narrative content to JSON

Exported via Supabase MCP execute_sql from v1 project iwfjbjukqljkrqwibglp before pausing it. Source data for M2+ narrative layer when it returns.

- cities.json: 1 row (Edinburgh)
- city_editions.json: 1 row (Modern Edinburgh)
- city_versions.json: 4 rows (~133 KB jsonb payloads)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Push branch**

```bash
git push -u origin feat/phase-2a-content-export
```

- [ ] **Step 3: Open PR**

```bash
gh pr create --base dev --head feat/phase-2a-content-export \
  --title "chore: archive v1 narrative content" \
  --body "$(cat <<'EOF'
## What changed

Export v1 narrative tables (cities, city_editions, city_versions) to `content/v1-narrative-archive/*.json`. Adds README documenting provenance and intent for M2+ reuse.

## How tested

- `cat content/v1-narrative-archive/city_versions.json | jq '. | length'` → 4
- File sizes match expected (~133 KB total for versions)
- README explains provenance

## Checklist

- [x] CI green locally
- [ ] Migration touched? N/A
- [ ] RLS or Realtime touched? N/A
- [ ] Server Action takes user input? N/A
- [ ] chess.js imported? N/A
EOF
)"
```

- [ ] **Step 4: Wait for CI + merge**

```bash
gh pr checks
gh pr merge --merge --delete-branch
```

- [ ] **Step 5: Pull dev locally**

```bash
git checkout dev
git pull
```

### Task 6: Pause v1 Supabase project

**Files:** none (Supabase dashboard work; user-attended)

- [ ] **Step 1: Verify exports are committed to dev**

```bash
ls C:/workspace/narrative-chess-v2/content/v1-narrative-archive/
```

Expected: README.md, cities.json, city_editions.json, city_versions.json.

- [ ] **Step 2: Open v1 project in Supabase dashboard**

Navigate to https://supabase.com/dashboard/project/iwfjbjukqljkrqwibglp/settings/general

- [ ] **Step 3: Click "Pause project"**

In the General settings, click "Pause project". Confirm. Project enters paused state. Free-tier projects auto-pause after 7 days idle anyway, but explicit pause prevents accidental re-use during v2 development.

- [ ] **Step 4: Verify**

In the project list https://supabase.com/dashboard/projects, v1 should now show "Paused" status. (To resume later: "Restore project" button — takes ~30 seconds.)

---

## Phase 2B — Fresh Supabase project + auth shell

### Task 7: Create fresh v2 Supabase project

**Files:** none (Supabase dashboard work; user-attended)

- [ ] **Step 1: Branch off dev**

```bash
cd C:/workspace/narrative-chess-v2
git checkout dev
git pull
git checkout -b feat/phase-2b-supabase-auth
```

- [ ] **Step 2: Create project in Supabase dashboard**

Go to https://supabase.com/dashboard/projects → click "New project". Settings:

| Field | Value |
|---|---|
| Name | `narrative-chess-v2` |
| Database password | Generate strong, save to password manager |
| Region | `Central EU (Frankfurt)` (eu-central-1) — matches v1 latency profile |
| Pricing plan | Free |

Click "Create new project". Wait ~2 min for provisioning.

- [ ] **Step 3: Note project credentials**

After provisioning, go to Project Settings → API. Note three values:

- **Project URL**: `https://<ref>.supabase.co`
- **`anon` public key**: starts with `eyJ...` (publishable; safe in browser)
- **`service_role` secret key**: starts with `eyJ...` (server-only; NEVER ship to browser)

Also note the **project reference ID** (the `<ref>` portion of the URL, ~20 lowercase alphanumeric chars).

### Task 8: Add Supabase env vars to Vercel + local .env.local

**Files:**
- Create: `.env.local` (NOT committed)
- Create: `.env.local.example` (committed)

- [ ] **Step 1: Add env vars to Vercel project**

Go to Vercel project Settings → Environment Variables. Add:

| Name | Value | Scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL from Task 7 | Production + Preview + Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key from Task 7 | Production + Preview + Development |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key from Task 7 | Production + Preview only (NOT Development) |

- [ ] **Step 2: Create `.env.local` for local dev**

In repo root:

```bash
cat > C:/workspace/narrative-chess-v2/.env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
EOF
```

(Replace placeholders with real values from Task 7.)

- [ ] **Step 3: Verify `.env.local` is gitignored**

```bash
cat C:/workspace/narrative-chess-v2/.gitignore | grep -E '\.env|\.local'
```

Expected: pattern matching `.env*.local` or `.env.local`. Default Next.js `.gitignore` includes this.

- [ ] **Step 4: Create `.env.local.example` (committed)**

```bash
cat > C:/workspace/narrative-chess-v2/.env.local.example <<'EOF'
# Supabase — get values from https://supabase.com/dashboard/project/<ref>/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Server-only; never expose to client
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
EOF
```

- [ ] **Step 5: Commit example file**

```bash
git add .env.local.example
git commit -m "docs: add .env.local.example with Supabase placeholder values"
```

### Task 9: Init Supabase CLI + link to project

**Files:**
- Create: `supabase/config.toml` (auto-generated)
- Create: `supabase/.gitignore` (auto-generated)
- Create: `supabase/seed.sql` (auto-generated, may be empty)

- [ ] **Step 1: Install Supabase CLI globally**

```bash
bun add -g supabase
supabase --version
```

Expected: version printed.

- [ ] **Step 2: Login**

```bash
supabase login
```

Opens browser. Authenticate with the Supabase account that owns the project.

- [ ] **Step 3: Init in repo**

```bash
cd C:/workspace/narrative-chess-v2
supabase init
```

Expected: creates `supabase/config.toml`, `supabase/.gitignore`, prompts about VS Code Deno settings (decline; we don't use Deno here).

- [ ] **Step 4: Link to v2 project**

```bash
supabase link --project-ref <ref>
```

Replace `<ref>` with the project ref from Task 7 Step 3. Will prompt for the database password (the strong password generated in Task 7 Step 2). Save the password in a password manager — Supabase only shows it once.

Expected: `Finished supabase link.` in terminal.

- [ ] **Step 5: Verify**

```bash
ls supabase/
cat supabase/config.toml | head -15
```

Expected: `config.toml`, `.gitignore`, possibly `seed.sql`. `config.toml` contains the project ref.

- [ ] **Step 6: Commit init**

```bash
git add supabase/
git commit -m "chore: supabase init + link to v2 project"
```

### Task 10: Create profiles + handle_new_user trigger migration

**Files:**
- Create: `supabase/migrations/<timestamp>_init_profiles.sql`

- [ ] **Step 1: Generate migration file**

```bash
cd C:/workspace/narrative-chess-v2
supabase migration new init_profiles
```

Expected: creates an empty file at `supabase/migrations/<timestamp>_init_profiles.sql`. Note the exact filename printed.

- [ ] **Step 2: Write the migration**

Open the file from Step 1 and replace its contents with:

```sql
-- Phase 2 — public.profiles + auto-create trigger
-- Spec: docs/superpowers/specs/2026-05-02-v2-foundation-design.md §6.1

set check_function_bodies = off;

-- 1. Profile table mirrors auth.users with app-level fields
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username is null or username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'App-level user profile, auto-created via trigger on auth.users insert.';

-- 2. RLS: read-all-authenticated, update-own
alter table public.profiles enable row level security;

create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3. Trigger: on auth.users insert, create matching profile row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
```

- [ ] **Step 3: Push migration to remote**

```bash
supabase db push
```

Expected: prompts for confirmation, pushes the migration. Output: `Connecting to remote database...` then `Applying migration <timestamp>_init_profiles.sql...` then `Finished supabase db push.`

- [ ] **Step 4: Verify in Supabase Studio**

Open https://supabase.com/dashboard/project/<ref>/database/tables. Expected:

- `profiles` table exists in `public` schema
- RLS enabled (lock icon)
- Two policies visible (`profiles_select_authenticated`, `profiles_update_own`)

Then https://supabase.com/dashboard/project/<ref>/database/triggers. Expected:

- `on_auth_user_created` trigger on `auth.users`
- `profiles_touch_updated_at` trigger on `public.profiles`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: profiles table + auto-create trigger on signup"
```

### Task 11: Add Zod env-var validation

**Files:**
- Create: `lib/env.ts`

- [ ] **Step 1: Write env validator**

```typescript
// lib/env.ts
import { z } from "zod";

const ServerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

const ClientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const isServer = typeof window === "undefined";

export const env = isServer
  ? ServerEnvSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
  : ClientEnvSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });

export type Env = typeof env;
```

- [ ] **Step 2: Verify import works**

```bash
bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/env.ts
git commit -m "feat: validate Supabase env vars at boot via zod"
```

### Task 12: Browser Supabase client

**Files:**
- Create: `lib/supabase/client.ts`

- [ ] **Step 1: Write browser client**

```typescript
// lib/supabase/client.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/client.ts
git commit -m "feat: browser-side Supabase client via @supabase/ssr"
```

### Task 13: Server Supabase client

**Files:**
- Create: `lib/supabase/server.ts`

- [ ] **Step 1: Write server client**

```typescript
// lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context — Server Actions / Route Handlers will set cookies properly.
            // Safe to ignore here as long as middleware refreshes the session.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/server.ts
git commit -m "feat: server-side Supabase client via @supabase/ssr"
```

### Task 14: Middleware client + root middleware

**Files:**
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Write middleware client helper**

```typescript
// lib/supabase/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() refreshes the session. Do not remove.
  await supabase.auth.getUser();

  return supabaseResponse;
}
```

- [ ] **Step 2: Write root middleware**

```typescript
// middleware.ts
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on all routes except static assets, images, favicon
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 3: Verify boot still works**

```bash
bun run dev
```

Open http://localhost:3000. Expected: Next.js welcome page renders, no console errors. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/middleware.ts middleware.ts
git commit -m "feat: Supabase auth session refresh middleware"
```

### Task 15: Sign-up page

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/sign-up/page.tsx`
- Create: `app/(auth)/sign-up/actions.ts`

- [ ] **Step 1: Auth route-group layout**

```typescript
// app/(auth)/layout.tsx
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Sign-up server action**

```typescript
// app/(auth)/sign-up/actions.ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const SignUpInput = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  displayName: z.string().min(1).max(60),
});

export async function signUp(formData: FormData) {
  const parsed = SignUpInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}
```

- [ ] **Step 3: Sign-up page (Client Component using Server Action)**

```tsx
// app/(auth)/sign-up/page.tsx
"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { signUp } from "./actions";

const initialState: { error?: string } = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-foreground text-background py-2 font-medium disabled:opacity-50"
    >
      {pending ? "Creating account..." : "Sign up"}
    </button>
  );
}

export default function SignUpPage() {
  const [state, formAction] = useFormState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await signUp(formData);
      return result ?? initialState;
    },
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      <h1 className="text-2xl font-semibold">Sign up</h1>
      <input
        name="displayName"
        type="text"
        placeholder="Display name"
        required
        className="w-full border rounded px-3 py-2"
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="w-full border rounded px-3 py-2"
      />
      <input
        name="password"
        type="password"
        placeholder="Password (min 8 chars)"
        required
        minLength={8}
        className="w-full border rounded px-3 py-2"
      />
      {state.error ? (
        <p className="text-red-600 text-sm">{state.error}</p>
      ) : null}
      <SubmitButton />
      <p className="text-sm text-center">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 4: Run typecheck**

```bash
bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(auth\)/
git commit -m "feat: sign-up page with email + password + display name"
```

### Task 16: Login page

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/login/actions.ts`

- [ ] **Step 1: Login server action**

```typescript
// app/(auth)/login/actions.ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(formData: FormData) {
  const parsed = LoginInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Invalid email or password" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Invalid email or password" };
  }

  redirect("/");
}
```

- [ ] **Step 2: Login page**

```tsx
// app/(auth)/login/page.tsx
"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { login } from "./actions";

const initialState: { error?: string } = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-foreground text-background py-2 font-medium disabled:opacity-50"
    >
      {pending ? "Logging in..." : "Log in"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await login(formData);
      return result ?? initialState;
    },
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="w-full border rounded px-3 py-2"
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        required
        className="w-full border rounded px-3 py-2"
      />
      {state.error ? (
        <p className="text-red-600 text-sm">{state.error}</p>
      ) : null}
      <SubmitButton />
      <p className="text-sm text-center">
        No account?{" "}
        <Link href="/sign-up" className="underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(auth\)/login/
git commit -m "feat: login page with email + password"
```

### Task 17: Logout server action

**Files:**
- Create: `app/auth/logout/route.ts`

(Using a Route Handler instead of a page for logout — POST-only, no UI.)

- [ ] **Step 1: Write route handler**

```typescript
// app/auth/logout/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
}
```

(Note: `NEXT_PUBLIC_SITE_URL` not yet defined — the fallback handles dev. Will be set as a Vercel env var when production URL is finalized.)

- [ ] **Step 2: Commit**

```bash
git add app/auth/
git commit -m "feat: logout route handler"
```

### Task 18: Replace landing page with auth-aware welcome

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Overwrite app/page.tsx**

```tsx
// app/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-6">
          <h1 className="text-3xl font-bold">Narrative Chess</h1>
          <p className="text-lg">
            Chess-first multiplayer game with narrative layers (M2+).
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/sign-up"
              className="rounded bg-foreground text-background px-4 py-2 font-medium"
            >
              Sign up
            </Link>
            <Link href="/login" className="rounded border px-4 py-2 font-medium">
              Log in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Authenticated: show profile snippet
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("user_id", user.id)
    .single();

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-3xl font-bold">
          Hello, {profile?.display_name ?? user.email}
        </h1>
        <p className="text-sm text-foreground/60">
          Phase 1+2 verified — auth + profile shell working. M1 game UI ships in Phase 4-5.
        </p>
        <form action="/auth/logout" method="post">
          <button type="submit" className="rounded border px-4 py-2 text-sm">
            Log out
          </button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: auth-aware landing page (sign-up/login or profile greeting)"
```

### Task 19: Verify auth flow end-to-end (manual)

**Files:** none (manual verification)

- [ ] **Step 1: Start dev server**

```bash
bun run dev
```

- [ ] **Step 2: Sign up a test user**

Open http://localhost:3000 → click "Sign up" → fill in: display name "Test One", email `test1@example.com`, password `password123` → submit.

Expected: redirect to landing page showing "Hello, Test One".

- [ ] **Step 3: Verify profile row exists**

Open Supabase Studio → `profiles` table. Expected: 1 row with `display_name = 'Test One'`, `user_id` matching the auth user just created.

- [ ] **Step 4: Refresh page**

Hard-refresh the browser. Expected: still logged in, still showing "Hello, Test One".

- [ ] **Step 5: Open second tab**

Open http://localhost:3000 in a second tab (same browser). Expected: still logged in. (This proves the cookie session works across tabs — required for Realtime to function later.)

- [ ] **Step 6: Log out**

Click "Log out". Expected: redirected to landing page showing the unauthenticated welcome (Sign up / Log in buttons).

- [ ] **Step 7: Sign in again**

Click "Log in" → email `test1@example.com`, password `password123` → submit. Expected: redirect to landing page, "Hello, Test One".

- [ ] **Step 8: Sign up second test user (for later phases)**

Log out. Sign up a second user: display name "Test Two", email `test2@example.com`, password `password123`.

Verify in Supabase Studio that `profiles` now has 2 rows.

- [ ] **Step 9: Stop dev server (Ctrl+C)**

### Task 20: Configure Supabase Auth redirect URLs

**Files:** none (Supabase dashboard)

Vercel preview deploys won't be able to log in until allowed redirect URLs are configured.

- [ ] **Step 1: Open project Auth → URL Configuration**

https://supabase.com/dashboard/project/<ref>/auth/url-configuration

- [ ] **Step 2: Set Site URL**

`https://narrative-chess.vercel.app`

(If Phase 1 used a different production alias, use that instead.)

- [ ] **Step 3: Add Redirect URLs (allow list)**

Add each on its own line:

```
https://narrative-chess.vercel.app/**
https://dev-narrative-chess.vercel.app/**
http://localhost:3000/**
```

- [ ] **Step 4: Save**

Click "Save". Expected: settings persist.

### Task 21: Smoke test against deployed `dev` Vercel preview

**Files:** none (manual verification)

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/phase-2b-supabase-auth
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --base dev --head feat/phase-2b-supabase-auth \
  --title "feat: Supabase auth shell (signup, login, profile, middleware)" \
  --body "$(cat <<'EOF'
## What changed

- `supabase init` + `link` to fresh v2 project
- `supabase/migrations/<ts>_init_profiles.sql`: profiles table, RLS, auto-create trigger, updated_at trigger
- `lib/env.ts`: zod-validated env vars
- `lib/supabase/{client,server,middleware}.ts`: three @supabase/ssr clients
- `middleware.ts`: session refresh
- `app/(auth)/{sign-up,login}/`: pages + Server Actions + Zod input validation
- `app/auth/logout/route.ts`: logout route handler
- `app/page.tsx`: auth-aware landing page
- `.env.local.example`: template for local dev

## How tested

Local against fresh Supabase project:
- Signup creates auth.users row + profiles row (verified in Studio)
- Refresh persists session
- Second tab shares session (RLS+Realtime gate dependency)
- Login works
- Logout clears session

## Checklist

- [x] CI green locally
- [x] Migration touched? Yes — `supabase db reset` works locally; pushed to remote
- [ ] RLS or Realtime touched? Yes — RLS on profiles. No Realtime yet (Phase 3).
- [x] Server Action takes user input? Yes — Zod validates signup + login inputs
- [ ] chess.js imported? N/A (Phase 4)
EOF
)"
```

- [ ] **Step 3: Wait for CI**

```bash
gh pr checks
```

Expected: green.

- [ ] **Step 4: Merge to dev**

```bash
gh pr merge --merge --delete-branch
git checkout dev
git pull
```

- [ ] **Step 5: Wait for Vercel `dev` preview to redeploy**

Check Vercel dashboard. After deploy completes, open `https://dev-narrative-chess.vercel.app` (or whatever the dev alias is).

- [ ] **Step 6: Sign up + log in on the live preview**

Use a different test email (e.g., `test3@example.com`) so it doesn't conflict with local test users.

Expected: signup works on the live preview, profile row appears in Supabase Studio, redirect lands on the auth-aware landing page.

If signup fails with "redirect URL not allowed", revisit Task 20 and confirm the dev preview URL is in the allow list.

---

## Phase 2 done — verification gate

- [ ] v1 narrative content archived to `content/v1-narrative-archive/*.json`, committed and merged to `dev`
- [ ] v1 Supabase project paused (verified in dashboard)
- [ ] v2 Supabase project created and linked via `supabase link`
- [ ] `supabase/migrations/<ts>_init_profiles.sql` applied to remote (verified in Studio)
- [ ] Vercel env vars configured (Production + Preview + Development scopes)
- [ ] Local `bun run dev` lets a test user sign up, log out, log in, refresh, second-tab
- [ ] Profile row appears in `public.profiles` after signup (trigger working)
- [ ] Live `dev-narrative-chess.vercel.app` lets a third test user complete the same flow

When all 8 boxes ticked, Phase 2 is shippable. Move to Phase 3 (`docs/superpowers/plans/2026-05-02-v2-phase-3-schema-rls-realtime-gate.md`).

---

## What's next (Phase 3 preview)

Phase 3 covers spec Step I: `games` + `game_moves` migration + RLS policies + Realtime publications + the **critical two-browser RLS+Realtime sanity gate** before any UI work begins. Phase 3 is the gate. If Phase 3 fails, no UI gets built until the failure is understood and fixed — that's the lesson from v1.
