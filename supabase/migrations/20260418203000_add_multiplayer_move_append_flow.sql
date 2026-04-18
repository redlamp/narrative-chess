alter table public.game_moves
  add column if not exists snapshot_payload jsonb;

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
  deadline_at timestamptz
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
  v_next_ply integer;
  v_next_turn text;
  v_next_status text;
  v_next_deadline timestamptz;
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
    gt.move_deadline_seconds
    into
      v_side,
      v_thread_status,
      v_current_turn,
      v_time_control_kind,
      v_move_deadline_seconds
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

  update public.game_threads
  set
    status = v_next_status,
    current_turn = v_next_turn,
    current_fen = coalesce(p_fen_after, current_fen),
    result = case
      when p_is_checkmate then v_side
      when p_is_stalemate then 'draw'
      else result
    end,
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
    deadline_at = v_next_deadline
  where id = p_game_id;

  return query
  select
    gt.id,
    v_next_ply,
    gt.status,
    gt.current_turn,
    gt.deadline_at
  from public.game_threads gt
  where gt.id = p_game_id;
end;
$$;

revoke all on function public.append_game_move(uuid, text, text, text, text, text, jsonb, boolean, boolean) from public;
grant execute on function public.append_game_move(uuid, text, text, text, text, text, jsonb, boolean, boolean) to authenticated;
