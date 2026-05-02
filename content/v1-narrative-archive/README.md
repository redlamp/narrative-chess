# v1 Narrative Archive

Snapshot of narrative content from v1 Supabase project (`iwfjbjukqljkrqwibglp`) exported on **2026-05-02** before the v1 project was paused and the v2 Supabase project created.

## Files

| File | Source table | Rows | Notes |
|---|---|---|---|
| `cities.json` | `public.cities` | 1 | Edinburgh |
| `city_editions.json` | `public.city_editions` | 1 | "Modern Edinburgh" — `is_default = true` |
| `city_versions.json` | `public.city_versions` | 4 | v1 published; v2-4 draft. Each `payload` ~31 KB jsonb (~64 districts) |

## Why archived

v1 schema coupled chess (`game_threads`) to narrative (`city_editions` foreign key). v2 starts with a chess-only schema; narrative comes M2+. When narrative layer returns, content here is the seed data — re-import into v2's schema, which will be designed narrative-on-top-of-chess (not the inverse that v1 attempted).

## Provenance

Source: v1 Supabase project (`iwfjbjukqljkrqwibglp`), `public` schema. Audited via Supabase MCP `list_tables` + `execute_sql` during V2 brainstorm session 2026-05-02.

Exported via Supabase MCP `execute_sql` queries:
- `cities`, `city_editions` — small tables, exported via direct query result
- `city_versions` — large jsonb payloads, exported by parsing the saved tool-result file (response exceeded MCP single-call token budget)

After export verified, v1 project was paused (Settings → Pause project) on 2026-05-02. To resume for further inspection: dashboard → Restore project (~30 second cold start).

## Schema reference (v1)

`cities`: `id` (text PK), `slug`, `name`, `country`, timestamps.

`city_editions`: `id` (text PK), `city_id` (FK), `slug`, `label`, `time_period`, `theme`, `is_default`, timestamps.

`city_versions`: `id` (uuid PK), `city_edition_id` (FK), `version_number` (int), `status` (`draft`/`published`/`archived`), `content_status` (`empty`/`procedural`/`authored`), `review_status`, `payload` (jsonb — the actual narrative content), `created_by` (FK to auth.users — null'd on archive), `notes`, `review_notes`, timestamps.

## Payload shape (one v1 row)

Top-level keys observed in `payload`: `id`, `name`, `country`, `summary`, `districts` (array of ~64 entries). Each district: `id`, `name`, `square` (chess coord like "a1"-"h8"), `locality`, `toneCues`, `landmarks`, `dayProfile`, `nightProfile`, `descriptors`, `mapAnchor` (sometimes), `radiusMeters` (sometimes), `reviewNotes`, `reviewStatus`, `contentStatus`, `lastReviewedAt`.

This shape is what M2+ narrative layer should expect when re-hydrating from the archive.
