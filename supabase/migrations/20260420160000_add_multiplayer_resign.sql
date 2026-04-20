create or replace function public.resign_game(
  p_game_id uuid
)
returns table (
  game_id uuid,
  status text,
  result text,
  current_turn text,
  deadline_at timestamptz,
  completed_at timestamptz,
  white_rating_delta integer,
  black_rating_delta integer
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_side text;
  v_thread_status text;
  v_is_rated boolean;
  v_rating_applied_at timestamptz;
  v_opponent_side text;
  v_opponent_user_id uuid;
  v_white_user_id uuid;
  v_black_user_id uuid;
  v_white_rating integer;
  v_black_rating integer;
  v_white_score numeric;
  v_black_score numeric;
  v_white_delta integer := null;
  v_black_delta integer := null;
  v_result text;
begin
  if v_user_id is null then
    raise exception 'Sign in to resign multiplayer games.';
  end if;

  select
    gp.side,
    gt.status,
    gt.rated,
    gt.rating_applied_at
    into
      v_side,
      v_thread_status,
      v_is_rated,
      v_rating_applied_at
  from public.game_threads gt
  join public.game_participants gp
    on gp.game_id = gt.id
  where gt.id = p_game_id
    and gp.user_id = v_user_id
    and gp.participant_status = 'active'
    and gp.side in ('white', 'black')
  for update of gt, gp;

  if v_side is null then
    raise exception 'That multiplayer game is not available for this account.';
  end if;

  if v_thread_status <> 'active' then
    raise exception 'Only active multiplayer games can be resigned.';
  end if;

  v_opponent_side := case when v_side = 'white' then 'black' else 'white' end;
  v_result := v_opponent_side;

  select gp.user_id
    into v_opponent_user_id
  from public.game_participants gp
  where gp.game_id = p_game_id
    and gp.side = v_opponent_side;

  if v_is_rated and v_rating_applied_at is null then
    select
      max(case when gp.side = 'white' then gp.user_id end),
      max(case when gp.side = 'black' then gp.user_id end)
      into v_white_user_id, v_black_user_id
    from public.game_participants gp
    where gp.game_id = p_game_id
      and gp.side in ('white', 'black');

    if v_white_user_id is not null then
      insert into public.profiles (user_id)
      values (v_white_user_id)
      on conflict (user_id) do nothing;
    end if;

    if v_black_user_id is not null then
      insert into public.profiles (user_id)
      values (v_black_user_id)
      on conflict (user_id) do nothing;
    end if;

    if v_white_user_id is not null and v_black_user_id is not null then
      select p.elo_rating into v_white_rating
      from public.profiles p
      where p.user_id = v_white_user_id;

      select p.elo_rating into v_black_rating
      from public.profiles p
      where p.user_id = v_black_user_id;

      if v_result = 'white' then
        v_white_score := 1;
        v_black_score := 0;
      else
        v_white_score := 0;
        v_black_score := 1;
      end if;

      v_white_delta := public.calculate_elo_delta(v_white_rating, v_black_rating, v_white_score);
      v_black_delta := public.calculate_elo_delta(v_black_rating, v_white_rating, v_black_score);

      update public.profiles
      set elo_rating = elo_rating + v_white_delta
      where user_id = v_white_user_id;

      update public.profiles
      set elo_rating = elo_rating + v_black_delta
      where user_id = v_black_user_id;
    end if;
  end if;

  update public.game_threads
  set
    status = 'completed',
    result = v_result,
    winner_user_id = v_opponent_user_id,
    completed_at = v_now,
    last_move_at = coalesce(last_move_at, v_now),
    current_turn = null,
    turn_started_at = null,
    deadline_at = null,
    rating_applied_at = case
      when v_is_rated and v_rating_applied_at is null then v_now
      else rating_applied_at
    end,
    white_rating_delta = case
      when v_is_rated and v_rating_applied_at is null then v_white_delta
      else white_rating_delta
    end,
    black_rating_delta = case
      when v_is_rated and v_rating_applied_at is null then v_black_delta
      else black_rating_delta
    end
  where id = p_game_id;

  return query
  select
    gt.id,
    gt.status,
    gt.result,
    gt.current_turn,
    gt.deadline_at,
    gt.completed_at,
    gt.white_rating_delta,
    gt.black_rating_delta
  from public.game_threads gt
  where gt.id = p_game_id;
end;
$$;

revoke all on function public.resign_game(uuid) from public;
grant execute on function public.resign_game(uuid) to authenticated;
