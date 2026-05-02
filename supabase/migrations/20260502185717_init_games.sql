-- Phase 3 — games + game_moves + RLS + Realtime publication
-- Spec: docs/superpowers/specs/2026-05-02-v2-foundation-design.md §6.1, §6.2

set check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- 1. games — one row per game; current_fen + ply cached for O(1) move append
-- ----------------------------------------------------------------------------

create table public.games (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  white_id uuid references public.profiles(user_id) on delete set null,
  black_id uuid references public.profiles(user_id) on delete set null,
  status text not null check (status in (
    'open',          -- created, awaiting opponent
    'in_progress',   -- both players present, white to move
    'white_won',
    'black_won',
    'draw',
    'aborted'
  )),
  current_fen text not null
    default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  current_turn text not null default 'w' check (current_turn in ('w','b')),
  ply integer not null default 0 check (ply >= 0),
  ended_at timestamptz
);

comment on table public.games is 'One row per chess game. current_fen + ply cached for O(1) move append via make_move RPC (added Phase 4).';

create index games_status_idx on public.games (status);
create index games_white_id_idx on public.games (white_id);
create index games_black_id_idx on public.games (black_id);

-- updated_at maintenance (uses helper from Phase 2 init_profiles migration)
drop trigger if exists games_touch_updated_at on public.games;
create trigger games_touch_updated_at
  before update on public.games
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 2. game_moves — append-only ledger; primary key (game_id, ply)
-- ----------------------------------------------------------------------------

create table public.game_moves (
  game_id uuid not null references public.games(id) on delete cascade,
  ply integer not null check (ply > 0),
  san text not null,
  uci text not null check (uci ~ '^[a-h][1-8][a-h][1-8][qrbn]?$'),
  fen_after text not null,
  played_by uuid not null references public.profiles(user_id) on delete restrict,
  played_at timestamptz not null default now(),
  primary key (game_id, ply)
);

comment on table public.game_moves is 'Append-only move ledger. Inserts only via make_move RPC (Phase 4); RLS allows SELECT for game participants.';

create index game_moves_played_by_idx on public.game_moves (played_by);

-- ----------------------------------------------------------------------------
-- 3. RLS — both tables enabled
-- ----------------------------------------------------------------------------

alter table public.games enable row level security;
alter table public.game_moves enable row level security;

-- games SELECT: participants OR rows where status = 'open' (open invite list)
create policy "games_select_participants_or_open" on public.games
  for select to authenticated
  using (
    auth.uid() = white_id
    or auth.uid() = black_id
    or status = 'open'
  );

-- games INSERT: deferred. Phase 4 adds a create_game RPC; for now, INSERT only via service_role.
-- (No INSERT/UPDATE/DELETE policies = locked except via SECURITY DEFINER functions.)

-- game_moves SELECT: only participants of the game
create policy "game_moves_select_participants" on public.game_moves
  for select to authenticated
  using (
    exists (
      select 1
      from public.games g
      where g.id = game_moves.game_id
        and (auth.uid() = g.white_id or auth.uid() = g.black_id)
    )
  );

-- game_moves INSERT: deferred to Phase 4 make_move RPC.

-- ----------------------------------------------------------------------------
-- 4. Realtime publication
-- ----------------------------------------------------------------------------

alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_moves;
