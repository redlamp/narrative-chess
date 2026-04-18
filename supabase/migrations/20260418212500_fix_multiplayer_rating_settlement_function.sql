drop function if exists public.append_game_move(uuid, text, text, text, text, text, jsonb, boolean, boolean);

create or replace function public.append_game_move(
  p_game_id uuid,
  p_from_square text,
  p_to_square text,
  p_promotion text default null,
  p_san text default null,
  p_fen_after text default null,
  p_snapshot_payload jsonb default null,
  p_is_checkmate boolean default false,
  p_is_stalemate boolean default false
)
returns table (
  game_id uuid,
  next_ply_number integer,
  status text,
  current_turn text,
  deadline_at timestamptz,
  result text,
  white_rating_delta integer,
  black_rating_delta integer
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_side text;
  v_thread_status text;
  v_current_turn text;
  v_time_control_kind text;
  v_move_deadline_seconds integer;
  v_is_rated boolean;
  v_rating_applied_at timestamptz;
  v_next_ply integer;
  v_next_turn text;
  v_next_status text;
  v_next_deadline timestamptz;
  v_result text;
  v_white_user_id uuid;
  v_black_user_id uuid;
  v_white_rating integer;
  v_black_rating integer;
  v_white_score numeric;
  v_black_score numeric;
  v_white_delta integer := null;
  v_black_delta integer := null;
begin
  if v_user_id is null then
    raise exception 'Sign in to sync multiplayer moves.';
  end if;

  if p_from_square !~ '^[a-h][1-8]$' or p_to_square !~ '^[a-h][1-8]$' then
    raise exception 'Move squares must be valid algebraic coordinates.';
  end if;

  if p_promotion is not null and p_promotion not in ('q', 'r', 'b', 'n') then
    raise exception 'Promotion must be q, r, b, or n.';
  end if;

  select
    gp.side,
    gt.status,
    gt.current_turn,
    gt.time_control_kind,
    gt.move_deadline_seconds,
    gt.rated,
    gt.rating_applied_at
    into
      v_side,
      v_thread_status,
      v_current_turn,
      v_time_control_kind,
      v_move_deadline_seconds,
      v_is_rated,
      v_rating_applied_at
  from public.game_threads gt
  join public.game_participants gp
    on gp.game_id = gt.id
  where gt.id = p_game_id
    and gp.user_id = v_user_id
    and gp.participant_status = 'active'
  for update of gt, gp;

  if v_side is null then
    raise exception 'That multiplayer game is not available for this account.';
  end if;

  if v_thread_status <> 'active' then
    raise exception 'Only active multiplayer games can accept moves.';
  end if;

  if v_current_turn is distinct from v_side then
    raise exception 'It is not your turn in this multiplayer game.';
  end if;

  select coalesce(max(gm.ply_number), 0) + 1
    into v_next_ply
  from public.game_moves gm
  where gm.game_id = p_game_id;

  insert into public.game_moves (
    game_id,
    ply_number,
    user_id,
    move_side,
    from_square,
    to_square,
    promotion,
    san,
    fen_after,
    snapshot_payload
  )
  values (
    p_game_id,
    v_next_ply,
    v_user_id,
    v_side,
    p_from_square,
    p_to_square,
    p_promotion,
    p_san,
    coalesce(p_fen_after, ''),
    p_snapshot_payload
  );

  v_next_status := case
    when p_is_checkmate or p_is_stalemate then 'completed'
    else 'active'
  end;

  v_result := case
    when p_is_checkmate then v_side
    when p_is_stalemate then 'draw'
    else null
  end;

  v_next_turn := case
    when p_is_checkmate or p_is_stalemate then null
    when v_side = 'white' then 'black'
    else 'white'
  end;

  v_next_deadline := case
    when p_is_checkmate or p_is_stalemate then null
    when v_time_control_kind = 'move_deadline' then now() + make_interval(secs => v_move_deadline_seconds)
    else null
  end;

  if v_next_status = 'completed' and v_is_rated and v_rating_applied_at is null then
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
      elsif v_result = 'black' then
        v_white_score := 0;
        v_black_score := 1;
      else
        v_white_score := 0.5;
        v_black_score := 0.5;
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
    status = v_next_status,
    current_turn = v_next_turn,
    current_fen = coalesce(p_fen_after, current_fen),
    result = coalesce(v_result, result),
    winner_user_id = case
      when p_is_checkmate then v_user_id
      when p_is_stalemate then null
      else winner_user_id
    end,
    completed_at = case
      when p_is_checkmate or p_is_stalemate then now()
      else completed_at
    end,
    last_move_at = now(),
    deadline_at = v_next_deadline,
    rating_applied_at = case
      when v_next_status = 'completed' and v_is_rated and v_rating_applied_at is null then now()
      else rating_applied_at
    end,
    white_rating_delta = case
      when v_next_status = 'completed' and v_is_rated and v_rating_applied_at is null then v_white_delta
      else white_rating_delta
    end,
    black_rating_delta = case
      when v_next_status = 'completed' and v_is_rated and v_rating_applied_at is null then v_black_delta
      else black_rating_delta
    end
  where id = p_game_id;

  return query
  select
    gt.id,
    v_next_ply,
    gt.status,
    gt.current_turn,
    gt.deadline_at,
    gt.result,
    gt.white_rating_delta,
    gt.black_rating_delta
  from public.game_threads gt
  where gt.id = p_game_id;
end;
$$;

revoke all on function public.append_game_move(uuid, text, text, text, text, text, jsonb, boolean, boolean) from public;
grant execute on function public.append_game_move(uuid, text, text, text, text, text, jsonb, boolean, boolean) to authenticated;
