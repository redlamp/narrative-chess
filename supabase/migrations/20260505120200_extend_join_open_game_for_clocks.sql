-- M1.5++ — set turn_started_at when game flips to in_progress on join
-- Spec: docs/superpowers/specs/2026-05-05-clocks-timeout-reconnect-design.md §5.2

set check_function_bodies = off;

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
    status = 'in_progress',
    turn_started_at = now()  -- M1.5++: clock starts when both players present
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
