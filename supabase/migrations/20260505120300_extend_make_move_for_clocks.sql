-- M1.5++ — make_move enforces deadline + applies clock math
-- Spec: docs/superpowers/specs/2026-05-05-clocks-timeout-reconnect-design.md §5.3

set check_function_bodies = off;

create or replace function public.make_move(
  p_game_id uuid,
  p_uci text,
  p_san text,
  p_fen_after text,
  p_expected_ply int,
  p_terminal_status text default null
)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
  v_caller uuid := auth.uid();
  v_new_status text;
  v_termination_reason text;
  v_active_remaining bigint;
  v_elapsed_ms bigint;
  v_new_active_remaining bigint;
  v_new_white_remaining bigint;
  v_new_black_remaining bigint;
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  select * into g from public.games where id = p_game_id for update;

  if not found then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;

  if v_caller <> g.white_id and v_caller <> g.black_id then
    raise exception 'not_a_participant' using errcode = 'P0001';
  end if;

  if g.ply <> p_expected_ply then
    raise exception 'concurrency_conflict' using errcode = 'P0001',
      detail = format('expected_ply=%s, current_ply=%s', p_expected_ply, g.ply);
  end if;

  if g.status <> 'in_progress' then
    raise exception 'not_active' using errcode = 'P0001',
      detail = format('current_status=%s', g.status);
  end if;

  if g.current_turn = 'w' and v_caller <> g.white_id then
    raise exception 'wrong_turn' using errcode = 'P0001';
  end if;
  if g.current_turn = 'b' and v_caller <> g.black_id then
    raise exception 'wrong_turn' using errcode = 'P0001';
  end if;

  -- ---- Lazy timeout check + clock math (only for timed games) ----
  if g.time_control_type is not null and g.turn_started_at is not null then
    v_active_remaining := case g.current_turn
      when 'w' then g.white_remaining_ms
      else g.black_remaining_ms
    end;
    v_elapsed_ms := greatest(
      0,
      (extract(epoch from (now() - g.turn_started_at)) * 1000)::bigint - 200
    );

    if v_elapsed_ms > v_active_remaining then
      -- Timeout. First-move = abort, otherwise = timeout-loss.
      if g.ply = 0 then
        update public.games
        set status = 'aborted',
            termination_reason = 'abort',
            ended_at = now()
        where id = p_game_id
        returning * into g;
        return g;
      else
        update public.games
        set status = case g.current_turn when 'w' then 'black_won' else 'white_won' end,
            termination_reason = 'timeout',
            ended_at = now()
        where id = p_game_id
        returning * into g;
        return g;
      end if;
    end if;

    -- Not expired: deduct elapsed and (live only) add increment.
    v_new_active_remaining := v_active_remaining - v_elapsed_ms;
    if g.time_control_type = 'live' then
      v_new_active_remaining := v_new_active_remaining
        + coalesce(g.time_increment_seconds, 0) * 1000;
    end if;

    if g.current_turn = 'w' then
      v_new_white_remaining := v_new_active_remaining;
      -- Correspondence: newly-active side's clock resets to per-move budget.
      v_new_black_remaining := case g.time_control_type
        when 'correspondence' then g.time_per_move_seconds * 1000
        else g.black_remaining_ms
      end;
    else
      v_new_black_remaining := v_new_active_remaining;
      v_new_white_remaining := case g.time_control_type
        when 'correspondence' then g.time_per_move_seconds * 1000
        else g.white_remaining_ms
      end;
    end if;
  else
    -- Untimed: no clock math, no deadline check.
    v_new_white_remaining := g.white_remaining_ms;
    v_new_black_remaining := g.black_remaining_ms;
  end if;

  v_new_status := coalesce(p_terminal_status, 'in_progress');
  if v_new_status not in ('in_progress','white_won','black_won','draw') then
    raise exception 'invalid_terminal_status' using errcode = 'P0001';
  end if;

  v_termination_reason := case
    when v_new_status = 'white_won' or v_new_status = 'black_won' then 'checkmate'
    when v_new_status = 'draw' then 'stalemate'
    else null
  end;

  insert into public.game_moves (game_id, ply, san, uci, fen_after, played_by)
  values (p_game_id, g.ply + 1, p_san, p_uci, p_fen_after, v_caller);

  update public.games
  set
    ply = g.ply + 1,
    current_fen = p_fen_after,
    current_turn = case when g.current_turn = 'w' then 'b' else 'w' end,
    status = v_new_status,
    termination_reason = v_termination_reason,
    ended_at = case when v_new_status in ('white_won','black_won','draw') then now() else null end,
    white_remaining_ms = v_new_white_remaining,
    black_remaining_ms = v_new_black_remaining,
    turn_started_at = case
      when v_new_status = 'in_progress' and g.time_control_type is not null then now()
      else g.turn_started_at
    end
  where id = p_game_id
  returning * into g;

  return g;
end;
$$;
