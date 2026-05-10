-- Polish A — draw-by-agreement
-- Adds the draw-offer column on games + four RPCs for the offer / withdraw /
-- accept / decline flow. The termination_reason CHECK constraint is extended
-- to include 'draw_agreement' so accept_draw can mark it explicitly.
--
-- Convention follows resign/abort/claim_timeout precedents:
-- - All RPCs run security definer with auth.uid() participant guard.
-- - Realtime publication on games (already enabled) carries draw_offered_by
--   updates to opponent + observers, no extra publication setup needed.

set check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- 1. games.draw_offered_by — uuid of the player who has a draw offer
--    currently outstanding. Null while no offer is live.
-- ----------------------------------------------------------------------------

alter table public.games
  add column draw_offered_by uuid
    references public.profiles(user_id) on delete set null;

comment on column public.games.draw_offered_by is
  'Player who has a draw offer outstanding. Null while no offer is live. '
  'Cleared on accept (terminal) / decline / withdraw / next move.';

-- ----------------------------------------------------------------------------
-- 2. Extend termination_reason CHECK to include draw_agreement.
--    The constraint was inline-defined in 20260503132654_resign_and_abort_rpcs.sql
--    so it has a Postgres-auto-generated name; introspect + rebuild.
--    (Pattern from 20260505120000_add_clocks_to_games.sql)
-- ----------------------------------------------------------------------------

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.games'::regclass
    and pg_get_constraintdef(oid) like '%termination_reason%';
  if cname is not null then
    execute format('alter table public.games drop constraint %I', cname);
  end if;
end $$;

alter table public.games
  add constraint games_termination_reason_check
    check (termination_reason in (
      'checkmate',
      'stalemate',
      'threefold',
      'fifty_move',
      'insufficient',
      'resignation',
      'abort',
      'timeout',
      'draw_agreement'
    ));

comment on column public.games.termination_reason is
  'How the game ended: checkmate / stalemate / threefold / fifty_move / '
  'insufficient / resignation / abort / timeout / draw_agreement. '
  'Null while game is open or in progress.';

-- ----------------------------------------------------------------------------
-- 3. offer_draw(p_game_id) — caller proposes a draw.
--    Pre: in_progress + caller is participant + ply >= 1 (no pre-game offers,
--    use abort instead) + no offer currently outstanding.
-- ----------------------------------------------------------------------------

create or replace function public.offer_draw(p_game_id uuid)
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

  if g.status <> 'in_progress' then
    raise exception 'not_active' using errcode = 'P0001',
      detail = format('current_status=%s', g.status);
  end if;

  if g.ply < 1 then
    raise exception 'pre_game' using errcode = 'P0001',
      detail = 'use abort_game before any move has been made';
  end if;

  if g.draw_offered_by is not null then
    raise exception 'offer_already_outstanding' using errcode = 'P0001',
      detail = format('offered_by=%s', g.draw_offered_by);
  end if;

  update public.games
  set draw_offered_by = v_caller
  where id = p_game_id
  returning * into g;

  return g;
end;
$$;

revoke all on function public.offer_draw(uuid) from public, anon;
grant execute on function public.offer_draw(uuid) to authenticated;

comment on function public.offer_draw(uuid) is
  'Caller proposes a draw. Sets games.draw_offered_by to caller. '
  'Errors if not a participant, not in_progress, ply < 1, or an offer is already outstanding.';

-- ----------------------------------------------------------------------------
-- 4. withdraw_draw(p_game_id) — caller pulls back their own offer.
--    Pre: caller IS draw_offered_by (only the offerer can withdraw).
-- ----------------------------------------------------------------------------

create or replace function public.withdraw_draw(p_game_id uuid)
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

  if g.draw_offered_by is null then
    raise exception 'no_offer' using errcode = 'P0001';
  end if;

  if g.draw_offered_by <> v_caller then
    raise exception 'not_offerer' using errcode = 'P0001';
  end if;

  update public.games
  set draw_offered_by = null
  where id = p_game_id
  returning * into g;

  return g;
end;
$$;

revoke all on function public.withdraw_draw(uuid) from public, anon;
grant execute on function public.withdraw_draw(uuid) to authenticated;

comment on function public.withdraw_draw(uuid) is
  'Caller withdraws their own outstanding draw offer. Errors if no offer is live or caller is not the offerer.';

-- ----------------------------------------------------------------------------
-- 5. accept_draw(p_game_id) — opponent of offerer agrees; game ends as draw.
--    Pre: offer outstanding + caller is participant + caller is NOT offerer.
-- ----------------------------------------------------------------------------

create or replace function public.accept_draw(p_game_id uuid)
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

  if g.status <> 'in_progress' then
    raise exception 'not_active' using errcode = 'P0001',
      detail = format('current_status=%s', g.status);
  end if;

  if g.draw_offered_by is null then
    raise exception 'no_offer' using errcode = 'P0001';
  end if;

  if g.draw_offered_by = v_caller then
    raise exception 'cannot_accept_own_offer' using errcode = 'P0001';
  end if;

  update public.games
  set
    status = 'draw',
    termination_reason = 'draw_agreement',
    draw_offered_by = null,
    ended_at = now()
  where id = p_game_id
  returning * into g;

  return g;
end;
$$;

revoke all on function public.accept_draw(uuid) from public, anon;
grant execute on function public.accept_draw(uuid) to authenticated;

comment on function public.accept_draw(uuid) is
  'Opponent of offerer accepts the draw. Status flips to draw, termination_reason=draw_agreement. '
  'Errors if no offer outstanding, not a participant, not in_progress, or caller is the offerer.';

-- ----------------------------------------------------------------------------
-- 6. decline_draw(p_game_id) — opponent of offerer rejects; game continues.
--    Pre: offer outstanding + caller is participant + caller is NOT offerer.
-- ----------------------------------------------------------------------------

create or replace function public.decline_draw(p_game_id uuid)
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

  if g.draw_offered_by is null then
    raise exception 'no_offer' using errcode = 'P0001';
  end if;

  if g.draw_offered_by = v_caller then
    raise exception 'cannot_decline_own_offer' using errcode = 'P0001';
  end if;

  update public.games
  set draw_offered_by = null
  where id = p_game_id
  returning * into g;

  return g;
end;
$$;

revoke all on function public.decline_draw(uuid) from public, anon;
grant execute on function public.decline_draw(uuid) to authenticated;

comment on function public.decline_draw(uuid) is
  'Opponent of offerer declines the draw. draw_offered_by cleared, game continues. '
  'Errors if no offer outstanding, not a participant, or caller is the offerer.';

-- ----------------------------------------------------------------------------
-- 7. make_move RPC — auto-clear draw_offered_by on every move.
--    Standard chess UX: making a move implicitly declines an outstanding draw
--    offer (or withdraws your own — same end state).
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
  v_now timestamptz := now();
  v_lag_ms int := 200;
  v_used_ms bigint;
  v_remaining bigint;
  v_other_remaining bigint;
  v_increment_ms int;
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

  v_termination_reason := case
    when v_new_status = 'white_won' or v_new_status = 'black_won' then 'checkmate'
    when v_new_status = 'draw' then 'stalemate'
    else null
  end;

  -- Clock math (carry-over from 20260505120300_extend_make_move_for_clocks).
  -- Untimed games skip the math; remaining columns stay NULL.
  if g.time_control_type is not null and g.time_control_type <> 'untimed' then
    if g.turn_started_at is not null then
      v_used_ms := greatest(0,
        extract(epoch from (v_now - g.turn_started_at)) * 1000 - v_lag_ms
      );
    else
      v_used_ms := 0;
    end if;

    v_increment_ms := coalesce(g.time_increment_seconds, 0) * 1000;

    if g.current_turn = 'w' then
      v_remaining := greatest(0, coalesce(g.white_remaining_ms, 0) - v_used_ms) + v_increment_ms;
      v_other_remaining := g.black_remaining_ms;
    else
      v_remaining := greatest(0, coalesce(g.black_remaining_ms, 0) - v_used_ms) + v_increment_ms;
      v_other_remaining := g.white_remaining_ms;
    end if;
  end if;

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
    ended_at = case when v_new_status in ('white_won','black_won','draw') then v_now else null end,
    -- Polish A: making a move implicitly declines / withdraws any outstanding draw offer.
    draw_offered_by = null,
    -- Clock state, only when timed.
    white_remaining_ms = case
      when g.time_control_type is null or g.time_control_type = 'untimed' then g.white_remaining_ms
      when g.current_turn = 'w' then v_remaining
      else g.white_remaining_ms
    end,
    black_remaining_ms = case
      when g.time_control_type is null or g.time_control_type = 'untimed' then g.black_remaining_ms
      when g.current_turn = 'b' then v_remaining
      else g.black_remaining_ms
    end,
    turn_started_at = case
      when g.time_control_type is null or g.time_control_type = 'untimed' then null
      when v_new_status = 'in_progress' then v_now
      else null
    end
  where id = p_game_id
  returning * into g;

  return g;
end;
$$;

comment on function public.make_move(uuid, text, text, text, int, text) is
  'Atomic move append. Server Action validates with chess.js; RPC checks participant + concurrency + status, '
  'inserts move, updates game, sets termination_reason on terminal transitions, '
  'auto-clears draw_offered_by, recomputes clock state when timed.';
