# V2 Phase 1 — Repo + CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land a complete v2 repo on GitHub with Next.js scaffolded, conventions wired, CI green, and Vercel deploying `dev` and `main` branches.

**Architecture:** Existing `narrative-chess-v2` folder already has `.claude/memory/`, `wiki/`, `docs/`, `CLAUDE.md`, and a local git repo with `dev` + `main` at `d28c342`. Phase 1 pushes that to a new GitHub repo, scaffolds Next.js into the same folder (preserving conventions), adds CI + branch protection + PR template + Husky, and connects Vercel.

**Tech Stack:** Next.js 16.2, React 19, TypeScript, Tailwind v4, shadcn/ui, Bun, GitHub Actions, Vercel Hobby, Husky.

**Spec reference:** `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` Steps A through F. This plan covers Phase 1 only. Phases 2-9 (Supabase, schema, RPC, UI, e2e, ship) get their own plans after Phase 1 is verified shipping.

**Working branch:** Tasks 3-19 happen on `feat/scaffold-next` off `dev`. Tasks 1-2 happen on `dev`. Tasks 22-25 are Vercel dashboard work (no branch).

---

## Phase 1A — Settle v1 + create v2 remote

### Task 1: Push v1's unpushed commit

**Files:**
- None (git operation only, in `C:/workspace/narrative-chess-v1`)

- [ ] **Step 1: Verify v1 working tree clean and 1 commit ahead**

```bash
cd C:/workspace/narrative-chess-v1
git status
git log --oneline origin/main..HEAD
```

Expected: working tree clean; one commit `58c6eca feat(ui): hide sign-in button + non-Historic Games tabs`.

- [ ] **Step 2: Push to origin**

```bash
git push origin main
```

Expected: success, fast-forward push of 1 commit.

- [ ] **Step 3: Verify**

```bash
git log --oneline origin/main..HEAD
```

Expected: empty output (local in sync with remote).

### Task 2: Create v2 GitHub repo + push

**Files:**
- None (git operation only, in `C:/workspace/narrative-chess-v2`)

- [ ] **Step 1: Confirm `narrative-chess` name is reclaimable**

```bash
gh repo view redlamp/narrative-chess --json name,visibility 2>&1
```

Expected: returns `narrative-chess-v1` (auto-redirect from old name). Means name is still reserved by redirect.

- [ ] **Step 2: Create fresh repo**

```bash
cd C:/workspace/narrative-chess-v2
gh repo create redlamp/narrative-chess --public \
  --description "Chess-first multiplayer game with narrative layer (v2 rebuild)" \
  --source . --remote origin
```

Expected: success message. Note that creating a fresh repo at `redlamp/narrative-chess` overrides the auto-redirect — old URL no longer redirects to v1 after this.

- [ ] **Step 3: Push both branches**

```bash
git push -u origin main
git push -u origin dev
```

Expected: both branches pushed, tracking set.

- [ ] **Step 4: Verify**

```bash
gh repo view redlamp/narrative-chess --json name,visibility,defaultBranchRef
```

Expected: `narrative-chess`, `PUBLIC`, default branch `main`.

```bash
gh api repos/redlamp/narrative-chess/branches --jq '.[].name'
```

Expected: lists `dev` and `main`.

---

## Phase 1B — Scaffold Next.js without losing conventions

### Task 3: Snapshot existing conventions before scaffold

**Files:**
- None (file-system snapshot only)

The scaffold step touches `.gitignore`, may try to write `README.md`, won't touch `.git/`, and ignores `.claude/` / `wiki/` / `docs/` / `CLAUDE.md` (it has no opinion on those). To be safe, snapshot everything into a sibling backup folder so any merge conflict can be resolved by copy.

- [ ] **Step 1: Create sibling backup folder**

```bash
mkdir -p C:/workspace/_v2-conventions-backup
```

- [ ] **Step 2: Copy current convention files**

```bash
cp -r C:/workspace/narrative-chess-v2/.claude C:/workspace/_v2-conventions-backup/.claude
cp -r C:/workspace/narrative-chess-v2/wiki C:/workspace/_v2-conventions-backup/wiki
cp -r C:/workspace/narrative-chess-v2/docs C:/workspace/_v2-conventions-backup/docs
cp -r C:/workspace/narrative-chess-v2/.remember C:/workspace/_v2-conventions-backup/.remember
cp C:/workspace/narrative-chess-v2/CLAUDE.md C:/workspace/_v2-conventions-backup/CLAUDE.md
cp C:/workspace/narrative-chess-v2/.gitignore C:/workspace/_v2-conventions-backup/.gitignore.original
```

- [ ] **Step 3: Verify backup**

```bash
ls -la C:/workspace/_v2-conventions-backup/
```

Expected: `.claude/`, `.remember/`, `wiki/`, `docs/`, `CLAUDE.md`, `.gitignore.original`.

### Task 4: Create scaffold branch and run create-next-app

**Files:**
- Modify: `C:/workspace/narrative-chess-v2/` (full Next.js scaffold)

- [ ] **Step 1: Create + checkout feature branch**

```bash
cd C:/workspace/narrative-chess-v2
git checkout dev
git checkout -b feat/scaffold-next
```

Expected: switched to new branch `feat/scaffold-next`.

- [ ] **Step 2: Run create-next-app into existing folder**

```bash
bun create next-app@latest . --ts --tailwind --app --import-alias="@/*" --no-src-dir --use-bun
```

Expected: scaffolder may prompt about non-empty directory and existing `.gitignore` / `README.md`. Choose to proceed (overwrite). It will not touch `.git/`, `.claude/`, `wiki/`, `docs/`, `.remember/`, or our `CLAUDE.md` (different from any Next.js default file).

- [ ] **Step 3: Verify scaffold installed**

```bash
ls -la C:/workspace/narrative-chess-v2/
```

Expected: new files including `app/`, `node_modules/`, `package.json`, `tsconfig.json`, `next.config.ts` (or `.js`), `tailwind.config.ts` (or v4 inline), `postcss.config.mjs`, `bun.lock`, `next-env.d.ts`, `.gitignore` (overwritten by Next.js default). Existing `.claude/`, `wiki/`, `docs/`, `.remember/`, `CLAUDE.md` should still be present.

### Task 5: Reconcile .gitignore + restore overwritten files

**Files:**
- Modify: `C:/workspace/narrative-chess-v2/.gitignore`

- [ ] **Step 1: Diff old and new .gitignore**

```bash
diff C:/workspace/_v2-conventions-backup/.gitignore.original C:/workspace/narrative-chess-v2/.gitignore
```

Expected: differences. Old had memory-system patterns; new has Next.js patterns.

- [ ] **Step 2: Merge by appending old custom patterns to new**

Open `C:/workspace/narrative-chess-v2/.gitignore` in editor, append the contents of `C:/workspace/_v2-conventions-backup/.gitignore.original` that are NOT already present in the new file. Typical Next.js .gitignore covers `node_modules`, `.next`, `out`, `.env*`, `coverage` — old custom patterns likely include cache/sweep paths or IDE configs.

```bash
# Quick way: concatenate, dedupe, replace
sort -u C:/workspace/narrative-chess-v2/.gitignore C:/workspace/_v2-conventions-backup/.gitignore.original > /tmp/.gitignore.merged
mv /tmp/.gitignore.merged C:/workspace/narrative-chess-v2/.gitignore
```

(If `sort -u` reorders unhelpfully, prefer hand-merge with editor.)

- [ ] **Step 3: Verify CLAUDE.md, .claude/, wiki/, docs/, .remember/ untouched**

```bash
ls C:/workspace/narrative-chess-v2/.claude/memory/
ls C:/workspace/narrative-chess-v2/wiki/notes/
cat C:/workspace/narrative-chess-v2/CLAUDE.md | head -5
```

Expected: project memory files, decision notes, project CLAUDE.md header — all unchanged.

- [ ] **Step 4: If anything was overwritten, restore from backup**

```bash
# Only run for paths confirmed missing or wrong
cp -r C:/workspace/_v2-conventions-backup/.claude C:/workspace/narrative-chess-v2/.claude
cp C:/workspace/_v2-conventions-backup/CLAUDE.md C:/workspace/narrative-chess-v2/CLAUDE.md
```

### Task 6: Install runtime + dev dependencies

**Files:**
- Modify: `C:/workspace/narrative-chess-v2/package.json` (deps added)
- Modify: `C:/workspace/narrative-chess-v2/bun.lock`

- [ ] **Step 1: Install runtime deps**

```bash
cd C:/workspace/narrative-chess-v2
bun add @supabase/supabase-js @supabase/ssr chess.js zod
```

Expected: deps added to `package.json` dependencies; `bun.lock` updated.

- [ ] **Step 2: Install dev deps**

```bash
bun add -d @playwright/test
```

Expected: added to `devDependencies`.

- [ ] **Step 3: Init Playwright**

```bash
bunx playwright install
```

Expected: downloads Chromium, Firefox, WebKit browsers.

- [ ] **Step 4: Verify deps in package.json**

```bash
cat package.json | grep -A 20 '"dependencies"'
```

Expected: `@supabase/supabase-js`, `@supabase/ssr`, `chess.js`, `zod` all present.

### Task 7: Init shadcn/ui

**Files:**
- Create: `C:/workspace/narrative-chess-v2/components.json`
- Create: `C:/workspace/narrative-chess-v2/lib/utils.ts`
- Modify: `C:/workspace/narrative-chess-v2/app/globals.css`
- Modify: `C:/workspace/narrative-chess-v2/tailwind.config.*`

- [ ] **Step 1: Run shadcn init**

```bash
cd C:/workspace/narrative-chess-v2
bunx shadcn@latest init
```

Expected prompts: choose Default style, choose Neutral base color, accept default paths. Confirm `components.json` is created.

- [ ] **Step 2: Verify**

```bash
ls components.json lib/utils.ts
```

Expected: both files exist.

### Task 8: Pin Bun version in package.json

**Files:**
- Modify: `C:/workspace/narrative-chess-v2/package.json`

- [ ] **Step 1: Check current Bun version**

```bash
bun --version
```

Note the exact version (e.g., `1.2.0`).

- [ ] **Step 2: Add `packageManager` field to package.json**

Open `package.json` and add at the top level (use the version from Step 1):

```json
{
  "name": "narrative-chess-v2",
  "version": "0.1.0",
  "private": true,
  "packageManager": "bun@1.2.0",
  ...
}
```

- [ ] **Step 3: Verify Node ignores it gracefully + Bun honors it**

```bash
bun install
```

Expected: install succeeds with no warning about packageManager mismatch.

### Task 9: Verify scaffold boots

**Files:**
- None (verification only)

- [ ] **Step 1: Start dev server**

```bash
cd C:/workspace/narrative-chess-v2
bun run dev
```

Expected: Next.js banner showing `localhost:3000`, no errors.

- [ ] **Step 2: Open in browser, confirm Next.js welcome page renders**

Open http://localhost:3000 in Chrome. Expected: Next.js default welcome content.

- [ ] **Step 3: Stop dev server (Ctrl+C)**

### Task 10: Commit scaffold

**Files:**
- All scaffold files staged

- [ ] **Step 1: Stage everything except node_modules**

```bash
cd C:/workspace/narrative-chess-v2
git add -A
git status --short
```

Expected: many added files (`app/`, `next.config.*`, `package.json`, `bun.lock`, etc.); `node_modules` excluded by `.gitignore`.

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore: scaffold Next.js 16 + shadcn + Supabase + Zod + Playwright

Run `bun create next-app .` into existing repo, init shadcn, add @supabase/supabase-js, @supabase/ssr, chess.js, zod, @playwright/test. Pin bun via package.json#packageManager.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push branch**

```bash
git push -u origin feat/scaffold-next
```

Expected: branch pushed.

---

## Phase 1C — Conventions: Vercel filter, CI, hooks, PR template, AI rails

### Task 11: Add vercel.json branch filter

**Files:**
- Create: `C:/workspace/narrative-chess-v2/vercel.json`

- [ ] **Step 1: Write vercel.json**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": {
      "main": true,
      "dev": true
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "chore: add vercel branch filter (main + dev only)"
```

### Task 12: Add GitHub Actions CI workflow

**Files:**
- Create: `C:/workspace/narrative-chess-v2/.github/workflows/ci.yml`

- [ ] **Step 1: Write workflow**

```yaml
name: CI

on:
  pull_request:
    branches: [main, dev]
  push:
    branches: [main, dev]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: package.json

      - name: Install deps
        run: bun install --frozen-lockfile

      - name: Lint
        run: bun run lint

      - name: Type-check
        run: bunx tsc --noEmit

      - name: Install Playwright browsers
        run: bunx playwright install --with-deps chromium

      - name: Run e2e
        run: bunx playwright test
        env:
          # Smoke-only at this point — Phase 1 has no real e2e yet
          CI: true
```

- [ ] **Step 2: Add lint script if missing**

Open `package.json`. Confirm `"scripts"` has `"lint": "next lint"`. If missing (Next 16 sometimes scaffolds without it), add:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint"
}
```

- [ ] **Step 3: Run lint locally to verify**

```bash
bun run lint
```

Expected: no errors on the scaffolded code.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml package.json
git commit -m "ci: add lint + typecheck + playwright workflow"
```

### Task 13: Add PR template

**Files:**
- Create: `C:/workspace/narrative-chess-v2/.github/pull_request_template.md`

- [ ] **Step 1: Write template**

```markdown
## What changed

(One-paragraph summary)

## How tested

(Specific verification steps run locally — not "ran the tests")

## Checklist

- [ ] CI green locally (`bun run lint && bunx tsc --noEmit && bunx playwright test`)
- [ ] Migration touched? If yes, ran `supabase db reset` locally OR accepted hosted-only risk
- [ ] RLS or Realtime touched? If yes, two-browser sanity test passed
- [ ] Server Action takes user input? If yes, validated with Zod
- [ ] chess.js imported? If yes, only inside `lib/chess/engine.ts`
```

- [ ] **Step 2: Commit**

```bash
git add .github/pull_request_template.md
git commit -m "chore: add PR template with v2-foundation checklist"
```

### Task 14: Set up Husky pre-commit hook

**Files:**
- Create: `C:/workspace/narrative-chess-v2/.husky/pre-commit`
- Modify: `C:/workspace/narrative-chess-v2/package.json`

- [ ] **Step 1: Install husky**

```bash
bun add -d husky lint-staged
```

- [ ] **Step 2: Init husky**

```bash
bunx husky init
```

Expected: creates `.husky/pre-commit` with default content; adds `prepare` script to `package.json`.

- [ ] **Step 3: Replace default pre-commit content**

Overwrite `.husky/pre-commit` with:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

bunx lint-staged
```

- [ ] **Step 4: Configure lint-staged in package.json**

Add to `package.json` top level:

```json
"lint-staged": {
  "*.{ts,tsx,js,jsx}": [
    "bun run lint --fix"
  ]
}
```

- [ ] **Step 5: Test by making a trivial edit and committing**

```bash
echo "// test" >> app/page.tsx
git add app/page.tsx
git commit -m "test: husky pre-commit"
```

Expected: lint-staged runs, no errors. If it fails, fix the issue and try again. Then revert the test change:

```bash
git reset --soft HEAD~1
git checkout app/page.tsx
```

- [ ] **Step 6: Commit husky setup**

```bash
git add .husky package.json bun.lock
git commit -m "chore: add husky + lint-staged pre-commit"
```

### Task 15: Append AI rails to project CLAUDE.md

**Files:**
- Modify: `C:/workspace/narrative-chess-v2/CLAUDE.md`

- [ ] **Step 1: Read current CLAUDE.md**

```bash
cat C:/workspace/narrative-chess-v2/CLAUDE.md
```

Note where to append (after `## Wiki` section, before EOF).

- [ ] **Step 2: Append new section**

Append to the end of `CLAUDE.md`:

```markdown

## AI rails for v2 implementation

### Stack pin

Next.js 16.2, React 19, TypeScript, Tailwind v4, shadcn/ui, Supabase JS + SSR, chess.js, Zod.

### Knowledge cutoff caveat

Claude's training cutoff is older than this stack. Verify Next.js / Supabase syntax against current docs (use WebFetch on the relevant docs page) before introducing patterns not already in the repo.

### File invariants

- DB writes only via Server Actions. Client never imports `service_role` key.
- Migrations only via `supabase migration new <name>`. Never edit a migration after `supabase db push`.
- chess.js imported only in `lib/chess/engine.ts`. Wrap, never spread.
- RLS policies live in same migration as the table they guard.
- Realtime publication changes always co-located with the relevant table migration.

### What NOT to touch

- `node_modules/` (rebuild from `bun install`)
- Past migrations (write a new one that alters)
- `auth.users` table directly — use `public.profiles` for app data

### Verification commands

- `bun run lint` — ESLint
- `bunx tsc --noEmit` — TypeScript check
- `bunx playwright test` — e2e
- `supabase db lint` — Supabase advisors (when Supabase CLI is installed)

### Pulling content from v1

`git clone https://github.com/redlamp/narrative-chess-v1 ../narrative-chess-v1` separately. Copy what's needed by hand. Never auto-import.

### Branch + commit conventions

- `feat/<short-name>` off `dev`. PR back to `dev`.
- `dev` → `main` via PR with linear history (no merge commits) and CI green.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `ci:`.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: append AI rails section for v2 implementation"
```

### Task 16: Add AGENTS.md stub

**Files:**
- Create: `C:/workspace/narrative-chess-v2/AGENTS.md`

- [ ] **Step 1: Write stub**

```markdown
# AGENTS.md

This project's source of truth for AI agents is `CLAUDE.md`. AGENTS.md exists for tools that look here by default (Cursor, Codex, Aider, etc.).

Read `CLAUDE.md` first. Read `wiki/CLAUDE.md` for wiki conventions. Read `.claude/memory/memory.md` for project memory index.

Both Cursor (via `.cursor/rules/` if present) and Copilot (via `.github/copilot-instructions.md` if present) should defer to `CLAUDE.md`.
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add AGENTS.md stub pointing to CLAUDE.md"
```

### Task 17: Add .mcp.json (Supabase MCP)

**Files:**
- Create: `C:/workspace/narrative-chess-v2/.mcp.json`

- [ ] **Step 1: Read v1 .mcp.json for reference**

```bash
cat C:/workspace/narrative-chess-v1/.mcp.json
```

Note the structure used.

- [ ] **Step 2: Write .mcp.json**

Match v1's pattern. Example shape (verify against the v1 file's actual content):

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp"
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add .mcp.json
git commit -m "chore: add .mcp.json with Supabase MCP server"
```

### Task 18: Update README.md

**Files:**
- Modify (or create): `C:/workspace/narrative-chess-v2/README.md`

- [ ] **Step 1: Overwrite README.md**

```markdown
# Narrative Chess V2

Chess-first multiplayer game with narrative layers. Rebuild of [narrative-chess-v1](https://github.com/redlamp/narrative-chess-v1).

## Run dev

```bash
bun install
bun run dev
```

Opens on http://localhost:3000.

## Stack

Next.js 16.2 · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Supabase · chess.js · Zod · Playwright.

## Layout

- `app/` — Next.js App Router routes + Server Actions
- `lib/chess/` — chess.js wrapper (sole import site)
- `lib/supabase/` — Supabase clients (browser, server, middleware)
- `lib/realtime/` — Supabase Realtime subscriptions
- `lib/schemas/` — Zod schemas
- `supabase/migrations/` — Database migrations (use `supabase migration new <name>`)
- `e2e/` — Playwright specs
- `wiki/` — Project knowledge graph (Obsidian)
- `docs/` — Specs, plans, ADRs

## More

- Conventions: see `CLAUDE.md`
- Design spec: `docs/superpowers/specs/2026-05-02-v2-foundation-design.md`
- Decisions: `wiki/mocs/decisions.md`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: replace default README with v2 quickstart"
```

---

## Phase 1D — Branch protection + open scaffold PR

### Task 19: Configure branch protection on main + dev

**Files:**
- None (GitHub API calls)

- [ ] **Step 1: Push current `feat/scaffold-next` to remote**

```bash
git push origin feat/scaffold-next
```

- [ ] **Step 2: Set branch protection on `main`**

```bash
gh api -X PUT repos/redlamp/narrative-chess/branches/main/protection \
  -f required_status_checks='{"strict":true,"contexts":["lint-and-test"]}' \
  -F enforce_admins=false \
  -f required_pull_request_reviews='{"required_approving_review_count":0}' \
  -F required_linear_history=true \
  -F allow_force_pushes=false \
  -F allow_deletions=false \
  -F restrictions=null
```

Expected: 200 OK response.

- [ ] **Step 3: Set branch protection on `dev`**

```bash
gh api -X PUT repos/redlamp/narrative-chess/branches/dev/protection \
  -f required_status_checks='{"strict":true,"contexts":["lint-and-test"]}' \
  -F enforce_admins=false \
  -f required_pull_request_reviews='{"required_approving_review_count":0}' \
  -F allow_force_pushes=false \
  -F allow_deletions=false \
  -F restrictions=null
```

Expected: 200 OK. (Note: linear history NOT required on `dev` — feature branches merge in via PR, history can have merge commits.)

- [ ] **Step 4: Verify in dashboard**

Open https://github.com/redlamp/narrative-chess/settings/branches in browser. Expected: both `main` and `dev` listed with required status check `lint-and-test`.

### Task 20: Open scaffold PR feat/scaffold-next → dev

**Files:**
- None (GitHub PR via gh)

- [ ] **Step 1: Open PR**

```bash
gh pr create --base dev --head feat/scaffold-next \
  --title "feat: scaffold Next.js 16 + conventions" \
  --body "$(cat <<'EOF'
## What changed

- Scaffold Next.js 16.2 + React 19 + Tailwind v4 + shadcn/ui via `bun create next-app`
- Install runtime deps: `@supabase/supabase-js`, `@supabase/ssr`, `chess.js`, `zod`
- Install dev deps: `@playwright/test`, `husky`, `lint-staged`
- Pin Bun via `package.json#packageManager`
- Add `vercel.json` branch filter (auto-deploy main + dev only)
- Add `.github/workflows/ci.yml` (lint + typecheck + e2e)
- Add `.github/pull_request_template.md`
- Add Husky pre-commit running lint-staged
- Append AI rails section to `CLAUDE.md`
- Add `AGENTS.md` stub pointing to CLAUDE.md
- Add `.mcp.json` with Supabase MCP server entry
- Replace default README with v2 quickstart

## How tested

- `bun run dev` boots Next.js on localhost:3000 with default welcome page rendering
- `bun run lint` returns clean
- `bunx tsc --noEmit` returns clean
- Husky pre-commit fires on staged TS/TSX edits

## Checklist

- [x] CI green locally
- [ ] Migration touched? N/A (no Supabase yet)
- [ ] RLS or Realtime touched? N/A
- [ ] Server Action takes user input? N/A (none yet)
- [x] chess.js imported only in `lib/chess/engine.ts` — N/A, not yet imported anywhere
EOF
)"
```

Expected: PR URL printed.

- [ ] **Step 2: Wait for CI to run, verify green**

```bash
gh pr checks
```

Expected: all checks pass (the only check at this point is `lint-and-test`).

- [ ] **Step 3: Merge to dev**

```bash
gh pr merge --merge --delete-branch
```

Expected: merged with merge commit; remote branch deleted; local branch deleted.

- [ ] **Step 4: Pull dev locally**

```bash
git checkout dev
git pull
```

Expected: dev now contains all the scaffolding work.

---

## Phase 1E — Vercel hookup

### Task 21: Vercel CLI install + login

**Files:**
- None (CLI install only)

- [ ] **Step 1: Install Vercel CLI globally via Bun**

```bash
bun add -g vercel
```

- [ ] **Step 2: Verify**

```bash
vercel --version
```

Expected: version printed.

- [ ] **Step 3: Login (opens browser, GitHub OAuth)**

```bash
vercel login
```

Choose "Continue with GitHub". Complete browser auth. Return to terminal.

Expected: `> Success! GitHub authentication complete for redlamp.`

### Task 22: Import project via Vercel dashboard (manual)

**Files:**
- None (web dashboard work)

This step is dashboard-only because importing through the UI walks through framework detection, env var entry, and Git permissions in one flow. CLI `vercel link` afterward associates the local folder.

- [ ] **Step 1: Open Vercel dashboard**

Browse to https://vercel.com/dashboard.

- [ ] **Step 2: Click "Add New" → "Project"**

- [ ] **Step 3: Click "Import Git Repository"**

Find `redlamp/narrative-chess` in the list. If not visible, click "Adjust GitHub App Permissions" → grant access to the repo.

- [ ] **Step 4: Click "Import" on `redlamp/narrative-chess`**

- [ ] **Step 5: Confirm framework auto-detection**

Expected: Vercel auto-detects "Next.js". Build command: `bun run build`. Output directory: `.next`. Install command: `bun install`. Don't change.

- [ ] **Step 6: Skip env vars for now**

Click "Deploy" without adding env vars. (Phase 2 / Step H of the spec adds Supabase env vars after the fresh Supabase project exists.)

- [ ] **Step 7: Wait for first deploy**

Expected: success. The deploy will be the `main` branch (since that's what's currently on GitHub default). The deployed app shows the Next.js welcome page (Server Components don't yet need any env vars).

- [ ] **Step 8: Note production URL**

After deploy, Vercel shows production URL like `narrative-chess-<hash>-redlamp.vercel.app`. Note it.

### Task 23: Set production domain alias

**Files:**
- None (Vercel dashboard)

- [ ] **Step 1: In Vercel project, go to Settings → Domains**

- [ ] **Step 2: Production domain**

The default `narrative-chess.vercel.app` should auto-claim (since project name = `narrative-chess`). If it didn't, click "Add" → enter `narrative-chess.vercel.app` → assign to `main` branch (Production).

- [ ] **Step 3: Add `dev` alias**

Click "Add" → enter `dev-narrative-chess.vercel.app` (note: hyphen, not subdomain — Vercel free tier doesn't allow custom subdomains on `.vercel.app`; only flat `.vercel.app` names are supported on free tier).

Assign to `dev` branch.

(If Vercel disallows due to a name conflict, fall back to `narrative-chess-dev.vercel.app` or similar. Match what becomes available.)

- [ ] **Step 4: Verify**

Push a no-op commit to `dev` to trigger redeploy:

```bash
git checkout dev
git commit --allow-empty -m "ci: verify dev deploy"
git push
```

Wait for Vercel to deploy. Open the dev alias URL — confirm Next.js welcome page renders.

### Task 24: Link local folder to Vercel project

**Files:**
- Create: `C:/workspace/narrative-chess-v2/.vercel/project.json` (auto-generated)
- Modify: `C:/workspace/narrative-chess-v2/.gitignore` (add `.vercel`)

- [ ] **Step 1: Run vercel link**

```bash
cd C:/workspace/narrative-chess-v2
vercel link
```

Prompts: confirm scope (your username), confirm project (`narrative-chess`). Accept.

Expected: creates `.vercel/project.json`.

- [ ] **Step 2: Add `.vercel` to .gitignore**

```bash
echo ".vercel" >> .gitignore
```

(Verify it's not already there — recent Next.js scaffolds may include it.)

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: vercel link + ignore .vercel"
git push
```

### Task 25: Verify branch filter actually filters

**Files:**
- None (smoke test)

- [ ] **Step 1: Create a throwaway branch**

```bash
git checkout dev
git checkout -b test/no-deploy
git commit --allow-empty -m "test: should not auto-deploy"
git push -u origin test/no-deploy
```

- [ ] **Step 2: Wait 60 seconds, then check Vercel deployments**

```bash
vercel list
```

Or check dashboard. Expected: no deployment for `test/no-deploy` branch.

- [ ] **Step 3: Clean up**

```bash
git push origin --delete test/no-deploy
git checkout dev
git branch -D test/no-deploy
```

---

## Phase 1 done — verification gate

Before declaring Phase 1 complete:

- [ ] `gh repo view redlamp/narrative-chess` shows public repo with `main` and `dev` branches
- [ ] `https://narrative-chess.vercel.app` (or your assigned alias) renders Next.js welcome page
- [ ] `https://dev-narrative-chess.vercel.app` (or equivalent dev alias) renders Next.js welcome page
- [ ] Pushing to a `feat/*` branch does NOT trigger a Vercel deploy
- [ ] CI runs green on `dev`
- [ ] Branch protection blocks direct push to `main` (test: try `git push origin dev:main` from local, expect rejection)
- [ ] Husky pre-commit fires on TS edits
- [ ] All decision notes + spec + project page committed to repo and visible on GitHub
- [ ] CLAUDE.md, AGENTS.md, README.md, .mcp.json all present at repo root

When all 9 boxes ticked, Phase 1 is shippable. Move to Phase 2 planning (Supabase fresh project + content export + auth shell).

---

## What's next (Phase 2 preview)

Phase 2 will be planned in its own document (`docs/superpowers/plans/<date>-v2-phase-2-supabase-foundation.md`) once Phase 1 is verified. Phase 2 covers spec Steps G (export v1 narrative content), H (fresh Supabase project + auth shell). Phase 2 is gated on Phase 1 complete because Vercel env vars need to point at the fresh Supabase project URL/keys, which don't exist until Phase 2 starts.

Subsequent phases (Phase 3 = schema + RLS + Realtime gate; Phase 4 = move RPC; Phase 5 = board UI + Realtime sync; Phase 6 = game lifecycle; Phase 7 = e2e; Phase 8 = ship M1) each get their own plan.
