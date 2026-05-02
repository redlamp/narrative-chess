# Narrative Chess V2

Chess-first multiplayer game with narrative layers. Rebuild of [narrative-chess-v1](https://github.com/redlamp/narrative-chess-v1).

## Run dev

```bash
bun install
bun run dev
```

Opens on http://localhost:3000.

## Stack

Next.js 16.2 · React 19 · TypeScript · Tailwind v4 · shadcn/ui (Radix, New York/Slate) · Supabase · chess.js · Zod · Playwright.

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
