-- Phase 4 — make_move RPC (atomic move append + concurrency check)
-- Spec: docs/superpowers/specs/2026-05-02-v2-foundation-design.md §6.3

set check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- make_move RPC
--
-- Trust boundary: the Server Action validates the move with chess.js and passes
-- the *already-validated* uci + san + fen_after + optional terminal_status.
-- The RPC's job is persistence + concurrency, not chess legality.
--
-- Why expected_ply: prevents (a) two clients racing the same move, and
-- (b) replay of an old move when a newer one has already landed.
--
-- Re-checks participant + caller's-turn + status explicitly because
-- SECURITY DEFINER bypasses RLS.
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
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  -- Lock the row so concurrent moves serialize.
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

  -- Append the move. PK (game_id, ply) prevents duplicates at same ply.
  insert into public.game_moves (game_id, ply, san, uci, fen_after, played_by)
  values (p_game_id, g.ply + 1, p_san, p_uci, p_fen_after, v_caller);

  -- Update game state atomically.
  update public.games
  set
    ply = g.ply + 1,
    current_fen = p_fen_after,
    current_turn = case when g.current_turn = 'w' then 'b' else 'w' end,
    status = v_new_status,
    ended_at = case when v_new_status in ('white_won','black_won','draw') then now() else null end
  where id = p_game_id
  returning * into g;

  return g;
end;
$$;

revoke all on function public.make_move(uuid, text, text, text, int, text) from public;
revoke all on function public.make_move(uuid, text, text, text, int, text) from anon;
grant execute on function public.make_move(uuid, text, text, text, int, text) to authenticated;

comment on function public.make_move(uuid, text, text, text, int, text) is
  'Atomic move append. Server Action validates with chess.js; RPC checks participant + concurrency + status, then inserts move and updates game.';
