---
tags:
  - domain/supabase
  - status/adopted
---

# Lesson — Postgres Function Signature Changes Drop the Old Form First

**Date learned:** 2026-05-05 (M1.5++ session)

## Symptom

Extending `create_game(text)` to `create_game(text, text, int, int, int)` without dropping the original leaves **both signatures coexisting** in the catalog. Overload resolution can pick either at call site, producing surprising behavior.

## Fix

Drop the old signature explicitly before creating the new one:

```sql
drop function if exists public.create_game(text);
create or replace function public.create_game(
  side text,
  time_control_type text,
  initial_seconds int,
  increment_seconds int,
  daily_seconds int
) returns ...
```

## Caller side

Once dropped, **all callers must pass the new signature simultaneously**. Mixed-state branches fail at runtime. Combined-PR over split-PR is the safe ship pattern when a server action calls into a renamed RPC — atomically migrate both sides.

## Related — auto-named CHECK constraints

When extending an existing inline `CHECK (...)` constraint (e.g., `termination_reason` was added inline in `20260503132654_resign_and_abort_rpcs.sql` and gets a Postgres-auto-generated name), don't guess the name. Drop via introspection:

```sql
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.games'::regclass
    and pg_get_constraintdef(oid) like '%termination_reason%';
  if cname is not null then
    execute format('alter table public.games drop constraint %I', cname);
  end if;
end $$;
```

Pattern in `supabase/migrations/20260505120000_add_clocks_to_games.sql`.

## See also

- `supabase/migrations/20260505120000_add_clocks_to_games.sql`
- `supabase/migrations/20260503132654_resign_and_abort_rpcs.sql`
