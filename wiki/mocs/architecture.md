# MOC — Architecture

System design, stack choices, data flow, integration points.

## Notes

### Diagnostics + verification gates

- [[realtime-rls-gate-procedure]] — manual two-browser test that proves Realtime + RLS deliver row data to participants and silence to non-participants

### Lessons learned

- [[lesson-realtime-auth-before-subscribe]] — Supabase `postgres_changes` silently denies events when `setAuth` races `channel.subscribe`. Always await session + setAuth before subscribing. (M1 ship — 2026-05-03)
- [[lesson-dev-main-merge-after-squash]] — Squash-merge culture causes `dev` ↔ `main` SHA divergence even when content matches. Expect add/add conflicts on milestone ship; resolve with `git checkout --ours`. (M1 ship — 2026-05-03)
