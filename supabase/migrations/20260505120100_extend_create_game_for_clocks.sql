-- M1.5++ — extend create_game to accept time control args
-- Spec: docs/superpowers/specs/2026-05-05-clocks-timeout-reconnect-design.md §5.1

set check_function_bodies = off;

-- Drop the old single-arg signature so callers must pass the new params.
drop function if exists public.create_game(text);

create or replace function public.create_game(
  p_my_color text,
  p_time_control_type text default null,
  p_time_initial_seconds int default null,
  p_time_increment_seconds int default 0,
  p_time_per_move_seconds int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_game_id uuid;
  v_white_remaining_ms bigint;
  v_black_remaining_ms bigint;
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  if p_my_color not in ('white', 'black') then
    raise exception 'invalid_color' using errcode = 'P0001',
      detail = format('expected white|black, got %s', p_my_color);
  end if;

  -- Validate time control shape (mirrors table constraint).
  if p_time_control_type is not null
     and p_time_control_type not in ('live','correspondence') then
    raise exception 'invalid_time_control_type' using errcode = 'P0001';
  end if;

  if p_time_control_type = 'live' then
    if p_time_initial_seconds is null or p_time_initial_seconds <= 0 then
      raise exception 'invalid_time_control' using errcode = 'P0001',
        detail = 'live requires positive time_initial_seconds';
    end if;
    if p_time_per_move_seconds is not null then
      raise exception 'invalid_time_control' using errcode = 'P0001',
        detail = 'live cannot set time_per_move_seconds';
    end if;
    v_white_remaining_ms := p_time_initial_seconds * 1000;
    v_black_remaining_ms := p_time_initial_seconds * 1000;
  elsif p_time_control_type = 'correspondence' then
    if p_time_per_move_seconds is null or p_time_per_move_seconds <= 0 then
      raise exception 'invalid_time_control' using errcode = 'P0001',
        detail = 'correspondence requires positive time_per_move_seconds';
    end if;
    if p_time_initial_seconds is not null then
      raise exception 'invalid_time_control' using errcode = 'P0001',
        detail = 'correspondence cannot set time_initial_seconds';
    end if;
    v_white_remaining_ms := p_time_per_move_seconds * 1000;
    v_black_remaining_ms := p_time_per_move_seconds * 1000;
  else
    -- untimed
    v_white_remaining_ms := null;
    v_black_remaining_ms := null;
  end if;

  insert into public.games (
    id,
    white_id,
    black_id,
    current_fen,
    current_turn,
    ply,
    status,
    time_control_type,
    time_initial_seconds,
    time_increment_seconds,
    time_per_move_seconds,
    white_remaining_ms,
    black_remaining_ms
  )
  values (
    gen_random_uuid(),
    case when p_my_color = 'white' then v_caller else null end,
    case when p_my_color = 'black' then v_caller else null end,
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'w',
    0,
    'open',
    p_time_control_type,
    case when p_time_control_type = 'live' then p_time_initial_seconds else null end,
    case when p_time_control_type = 'live' then coalesce(p_time_increment_seconds, 0) else null end,
    case when p_time_control_type = 'correspondence' then p_time_per_move_seconds else null end,
    v_white_remaining_ms,
    v_black_remaining_ms
  )
  returning id into v_game_id;

  return v_game_id;
end;
$$;

revoke all on function public.create_game(text, text, int, int, int) from public, anon;
grant execute on function public.create_game(text, text, int, int, int) to authenticated;

comment on function public.create_game(text, text, int, int, int) is
  'Create an open game with caller on requested side + time-control preset.';
