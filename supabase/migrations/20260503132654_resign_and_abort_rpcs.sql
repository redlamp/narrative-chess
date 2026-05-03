-- Phase 6 — termination_reason column + resign + abort_game RPCs
-- Spec: docs/superpowers/specs/2026-05-03-v2-phase-6-game-end-states-design.md §4

set check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- 1. games.termination_reason — captures HOW the game ended so the banner
--    can distinguish "white wins by checkmate" from "white wins by resignation".
--    Nullable; populated by the relevant RPC on terminal transitions.
-- ----------------------------------------------------------------------------

alter table public.games
  add column termination_reason text
    check (termination_reason in (
      'checkmate',
      'stalemate',
      'threefold',
      'fifty_move',
      'insufficient',
      'resignation',
      'abort'
    ));

comment on column public.games.termination_reason is
  'How the game ended: checkmate / stalemate / threefold / fifty_move / insufficient / resignation / abort. Null while game is open or in progress.';

-- ----------------------------------------------------------------------------
-- 2. make_move RPC — extend to populate termination_reason when a chess
--    engine terminal status is passed in. The Server Action passes
--    p_terminal_status; we map it to a termination_reason here so the RPC
--    is the single writer of the column for engine-driven endings.
--
--    The Server Action does NOT compute termination_reason — chess.js
--    already drives terminal_status in the engine wrapper. We translate
--    the status enum into a reason here, plus null on non-terminal moves.
-- ----------------------------------------------------------------------------

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

  v_new_status := coalesce(p_terminal_status, 'in_progress');
  if v_new_status not in ('in_progress','white_won','black_won','draw') then
    raise exception 'invalid_terminal_status' using errcode = 'P0001';
  end if;

  -- Map terminal status -> termination_reason. Chess.js drives this; the
  -- Server Action passes the status (which embeds the result) and we
  -- collapse it back to a reason. Resignation / abort have their own RPCs
  -- and never reach this branch.
  v_termination_reason := case
    when v_new_status = 'white_won' or v_new_status = 'black_won' then 'checkmate'
    when v_new_status = 'draw' then 'stalemate'  -- engine wrapper aggregates several into 'draw'; UI may want finer; for now, default to stalemate
    else null
  end;

  -- Append the move.
  insert into public.game_moves (game_id, ply, san, uci, fen_after, played_by)
  values (p_game_id, g.ply + 1, p_san, p_uci, p_fen_after, v_caller);

  update public.games
  set
    ply = g.ply + 1,
    current_fen = p_fen_after,
    current_turn = case when g.current_turn = 'w' then 'b' else 'w' end,
    status = v_new_status,
    termination_reason = v_termination_reason,
    ended_at = case when v_new_status in ('white_won','black_won','draw') then now() else null end
  where id = p_game_id
  returning * into g;

  return g;
end;
$$;

comment on function public.make_move(uuid, text, text, text, int, text) is
  'Atomic move append. Server Action validates with chess.js; RPC checks participant + concurrency + status, inserts move, updates game, sets termination_reason on terminal transitions.';

-- ----------------------------------------------------------------------------
-- 3. resign(p_game_id) — caller forfeits; opposite color wins.
-- ----------------------------------------------------------------------------

create or replace function public.resign(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
  v_caller uuid := auth.uid();
  v_new_status text;
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

  if g.status <> 'in_progress' then
    raise exception 'not_active' using errcode = 'P0001',
      detail = format('current_status=%s', g.status);
  end if;

  -- Caller forfeits; opponent wins.
  if v_caller = g.white_id then
    v_new_status := 'black_won';
  else
    v_new_status := 'white_won';
  end if;

  update public.games
  set
    status = v_new_status,
    termination_reason = 'resignation',
    ended_at = now()
  where id = p_game_id
  returning * into g;

  return g;
end;
$$;

revoke all on function public.resign(uuid) from public, anon;
grant execute on function public.resign(uuid) to authenticated;

comment on function public.resign(uuid) is
  'Caller forfeits the game; opposite color wins. Status flips and termination_reason=resignation.';

-- ----------------------------------------------------------------------------
-- 4. abort_game(p_game_id) — pre-move-1 escape; status -> aborted.
-- ----------------------------------------------------------------------------

create or replace function public.abort_game(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
  v_caller uuid := auth.uid();
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

  if g.ply > 0 or g.status not in ('open', 'in_progress') then
    raise exception 'not_abortable' using errcode = 'P0001',
      detail = format('ply=%s, status=%s', g.ply, g.status);
  end if;

  update public.games
  set
    status = 'aborted',
    termination_reason = 'abort',
    ended_at = now()
  where id = p_game_id
  returning * into g;

  return g;
end;
$$;

revoke all on function public.abort_game(uuid) from public, anon;
grant execute on function public.abort_game(uuid) to authenticated;

comment on function public.abort_game(uuid) is
  'Pre-move-1 abort. Either participant can call; ply must be 0. Status flips to aborted, termination_reason=abort.';
