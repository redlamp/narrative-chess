-- Phase 5 polish — observer viewing
--
-- Trust model: any authenticated user with the game's URL can watch a
-- game live (read-only). The UUID gameId is unguessable, so this
-- mirrors the same "share URL = grant viewing" pattern we already use
-- for open-game joins.
--
-- Observers cannot move pieces — write paths still go through the
-- make_move / create_game / join_open_game RPCs which all check
-- participant status. RLS only widens SELECT.
--
-- Strict-privacy game flag (e.g., games.public boolean) is deferred
-- until a real product need surfaces.

-- ----------------------------------------------------------------------------
-- public.games — add observer-friendly SELECT policy alongside the
-- existing games_select_participants_or_open. Postgres OR-merges policies
-- that target the same role + command, so we keep the original policy
-- for clarity ("here's the participant lane") and add a permissive one.
-- ----------------------------------------------------------------------------

create policy "games_select_observers" on public.games
  for select to authenticated
  using (true);

comment on policy "games_select_observers" on public.games is
  'Observer lane: any authenticated user with the URL can SELECT any game. Writes are still gated by RPCs.';

-- ----------------------------------------------------------------------------
-- public.game_moves — analogous policy. Realtime postgres_changes uses
-- the per-row RLS to decide delivery, so this is what lets observers
-- receive live INSERTs without joining the game.
-- ----------------------------------------------------------------------------

create policy "game_moves_select_observers" on public.game_moves
  for select to authenticated
  using (true);

comment on policy "game_moves_select_observers" on public.game_moves is
  'Observer lane: any authenticated user can SELECT any game_moves row. Realtime delivers INSERTs to non-participant subscribers via this policy.';
