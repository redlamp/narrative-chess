# Decision — Fresh Supabase Project for v2

**Date:** 2026-05-02
**Status:** Adopted

## Context

v1 Supabase project (`iwfjbjukqljkrqwibglp`, eu-central-1) accumulated 33 migrations across narrative + multiplayer features that grew interleaved. Audit on 2026-05-02 surfaced concrete state:

- `cities` (1 row), `city_editions` (1 row), `city_versions` (4 rows × ~33 KB jsonb each) — narrative content with real authoring value
- `game_threads` (3 rows), `game_participants` (6 rows), `game_moves` (**0** rows) — multiplayer schema with **zero played moves ever recorded**
- `profiles` (2 rows), `user_roles` (1 row), `user_layout_bundles` (0), `user_saved_matches` (0) — app data, mostly empty
- A `consolidate_and_optimize_rls_policies` migration mid-stream — RLS was patched after going wrong

The v1 schema also coupled chess to narrative via `game_threads.city_edition_id` foreign key.

## Options considered

1. Reuse v1 project; drop chess tables; keep narrative tables
2. Reuse v1 project; keep all tables; build v2 alongside legacy schema
3. **Fresh v2 project; export v1 narrative content to JSON first** (chosen)

## Choice

Create new Supabase project for v2. Before destroying anything: export `cities`, `city_editions`, `city_versions` to `content/v1-narrative-archive/{cities,editions,versions}.json` in the v2 repo. Pause v1 Supabase project (don't delete) so it remains queryable if M2+ needs more inspection.

## Why

- 0 played moves in v1 confirms multiplayer-on-narrative was structurally broken — carrying that forward = carrying the v1 trap
- RLS history is patched/messy; clean slate avoids debugging legacy policies
- Only data with real reuse value is the 4 city_versions (~133 KB total) — trivially exportable to JSON files
- Only 2 auth.users to recreate
- v1 schema's narrative-coupled chess tables would force v2 to either keep the FK (back into the trap) or break it (legacy policies misalign)
- Fresh project = zero baggage on RLS policy design

## Migration of narrative work

When narrative layer returns in M2+, content lives in `content/v1-narrative-archive/`. Re-import into the new schema (which will be designed narrative-on-top-of-chess, not the inverse).

## Risks / follow-ups

- Lose access to v1 chat-style game_threads metadata (3 rows). Acceptable — never produced played moves.
- v1 Supabase free tier auto-pauses after 7 days idle; don't conflate that with project deletion.
- If M2+ discovers more v1 content worth keeping (config, stored procedures, etc.), unpause v1 project temporarily and export.

## See also

- [[mocs/decisions]]
- `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` §4, §7 Step G
- v1 project ref: `iwfjbjukqljkrqwibglp`
