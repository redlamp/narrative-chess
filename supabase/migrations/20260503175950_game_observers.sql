-- Phase 7 — game_observers table + register_observer RPC
-- Spec: docs/superpowers/specs/2026-05-03-v2-phase-7-games-directory-and-observers-design.md §4.2-4.3

set check_function_bodies = off;

create table public.game_observers (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

create index game_observers_user_id_idx on public.game_observers (user_id);

comment on table public.game_observers is
  'Distinct authenticated viewers per game. Append-only via register_observer RPC.';

alter table public.game_observers enable row level security;

create policy "game_observers_select_authenticated" on public.game_observers
  for select to authenticated using (true);

create policy "game_observers_insert_own" on public.game_observers
  for insert to authenticated
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- register_observer(p_game_id) returns int
--
-- Idempotent — inserts the (game_id, caller) row if absent and the caller is
-- NOT a participant of the game; returns the current distinct-observer count
-- regardless. Participants who hit the function get the count without being
-- recorded as observers.
-- ----------------------------------------------------------------------------

create or replace function public.register_observer(p_game_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_count int;
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  insert into public.game_observers (game_id, user_id)
  select p_game_id, v_caller
  where not exists (
    select 1 from public.games g
    where g.id = p_game_id
      and (g.white_id = v_caller or g.black_id = v_caller)
  )
  on conflict (game_id, user_id) do nothing;

  select count(*) into v_count
  from public.game_observers
  where game_id = p_game_id;

  return v_count;
end;
$$;

revoke all on function public.register_observer(uuid) from public, anon;
grant execute on function public.register_observer(uuid) to authenticated;

comment on function public.register_observer(uuid) is
  'Records the caller as a distinct observer of the game (no-op if already recorded or if caller is a participant). Returns current observer count.';
