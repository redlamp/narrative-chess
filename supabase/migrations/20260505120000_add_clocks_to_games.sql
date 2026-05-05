-- M1.5++ — add clock columns + 'timeout' termination
-- Spec: docs/superpowers/specs/2026-05-05-clocks-timeout-reconnect-design.md §4

set check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- 1. games — add time-control + clock columns
-- ----------------------------------------------------------------------------

alter table public.games
  add column time_control_type text
    check (time_control_type in ('live', 'correspondence')),
  add column time_initial_seconds int,
  add column time_increment_seconds int default 0,
  add column time_per_move_seconds int,
  add column white_remaining_ms bigint,
  add column black_remaining_ms bigint,
  add column turn_started_at timestamptz;

comment on column public.games.time_control_type is
  'NULL=untimed (legacy or new); live=Fischer (initial+increment); correspondence=per-move deadline';
comment on column public.games.turn_started_at is
  'Wall-clock anchor for client interpolation + server elapsed math. NULL until in_progress.';

-- Constraint: live and correspondence have disjoint required column sets;
-- untimed is all NULL. New games may pick any.
alter table public.games
  add constraint games_time_control_shape check (
    (time_control_type = 'live'
       and time_initial_seconds is not null
       and time_per_move_seconds is null)
    or (time_control_type = 'correspondence'
       and time_per_move_seconds is not null
       and time_initial_seconds is null)
    or (time_control_type is null)
  );

-- ----------------------------------------------------------------------------
-- 2. termination_reason — add 'timeout' to allowed values
--
-- Original add-column check is auto-named by Postgres; resolve via
-- pg_constraint and drop, then re-add with timeout included.
-- ----------------------------------------------------------------------------

do $$
declare c_name text;
begin
  select conname into c_name
  from pg_constraint
  where conrelid = 'public.games'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%termination_reason%';
  if c_name is not null then
    execute format('alter table public.games drop constraint %I', c_name);
  end if;
end $$;

alter table public.games
  add constraint games_termination_reason_check check (
    termination_reason in (
      'checkmate','stalemate','threefold','fifty_move','insufficient',
      'resignation','abort','timeout'
    )
  );
