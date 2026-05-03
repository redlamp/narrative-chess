---
tags:
  - status/superseded
---

# Narrative Chess V1

Predecessor of [[narrative-chess-v2]]. Superseded after the 2026-05-02 audit — see [[decision-fresh-supabase-project]] for why v2 starts on a new Supabase project rather than evolving v1.

Repository remains intact (private after M1 ships). v1 Supabase project (`iwfjbjukqljkrqwibglp`) paused; narrative content exported to `content/v1-narrative-archive/` for re-import in M2+.

## Failure modes captured (drove v2 design)

- 0 played moves ever recorded — multiplayer-on-narrative coupling structurally broken.
- Realtime fired events but RLS denied SELECT — subscribers received empty rows. Procedure to prevent recurrence: [[realtime-rls-gate-procedure]].
- Migration history patched mid-stream (`consolidate_and_optimize_rls_policies`) — clean slate avoided in v2.

## Related

- [[narrative-chess-v2]]
- [[decision-fresh-supabase-project]]
- [[realtime-rls-gate-procedure]]
