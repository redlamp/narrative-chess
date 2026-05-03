-- Phase 5 — create_game + join_open_game RPCs
-- Spec: docs/superpowers/specs/2026-05-03-v2-phase-5-board-realtime-design.md §4.2

set check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- create_game(p_my_color text) returns uuid
--
-- Caller becomes white_id or black_id depending on p_my_color. Other side
-- starts null. status='open'. Initial FEN is the standard starting position.
-- Random selection happens in the Server Action, NOT here, because the RPC
-- is intentionally deterministic.
-- ----------------------------------------------------------------------------
create or replace function public.create_game(p_my_color text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_game_id uuid;
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  if p_my_color not in ('white', 'black') then
    raise exception 'invalid_color' using errcode = 'P0001',
      detail = format('expected white|black, got %s', p_my_color);
  end if;

  insert into public.games (
    id,
    white_id,
    black_id,
    current_fen,
    current_turn,
    ply,
    status
  )
  values (
    gen_random_uuid(),
    case when p_my_color = 'white' then v_caller else null end,
    case when p_my_color = 'black' then v_caller else null end,
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'w',
    0,
    'open'
  )
  returning id into v_game_id;

  return v_game_id;
end;
$$;

revoke all on function public.create_game(text) from public, anon;
grant execute on function public.create_game(text) to authenticated;

comment on function public.create_game(text) is
  'Create an open game with caller on the requested side. Other side null until joined.';

-- ----------------------------------------------------------------------------
-- join_open_game(p_game_id uuid) returns public.games
--
-- Atomic claim of the empty side on an open game. Row-locks then performs
-- a single UPDATE; concurrent joiners serialize on the row lock. Loser of
-- the race sees status flipped + already_filled; we enforce that case via
-- the UPDATE's WHERE clause (status='open' AND empty_side IS NULL).
-- ----------------------------------------------------------------------------
create or replace function public.join_open_game(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
  v_caller uuid := auth.uid();
  v_target_side text;
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  select * into g from public.games where id = p_game_id for update;

  if not found then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;

  if g.status <> 'open' then
    raise exception 'not_open' using errcode = 'P0001',
      detail = format('current_status=%s', g.status);
  end if;

  if g.white_id = v_caller or g.black_id = v_caller then
    raise exception 'already_a_participant' using errcode = 'P0001';
  end if;

  if g.white_id is null then
    v_target_side := 'white';
  elsif g.black_id is null then
    v_target_side := 'black';
  else
    raise exception 'already_filled' using errcode = 'P0001';
  end if;

  update public.games
  set
    white_id = case when v_target_side = 'white' then v_caller else white_id end,
    black_id = case when v_target_side = 'black' then v_caller else black_id end,
    status = 'in_progress'
  where id = p_game_id
    and status = 'open'
    and (
      (v_target_side = 'white' and white_id is null)
      or (v_target_side = 'black' and black_id is null)
    )
  returning * into g;

  if not found then
    raise exception 'already_filled' using errcode = 'P0001';
  end if;

  return g;
end;
$$;

revoke all on function public.join_open_game(uuid) from public, anon;
grant execute on function public.join_open_game(uuid) to authenticated;

comment on function public.join_open_game(uuid) is
  'Atomic claim of the empty side on an open game. Row-locks; concurrent joiners serialize.';
