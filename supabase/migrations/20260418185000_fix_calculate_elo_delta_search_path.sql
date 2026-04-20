-- Lock the search_path on calculate_elo_delta. Recovered from live Supabase
-- project state: the live DB had a parallel "fix_calculate_elo_delta_search_path"
-- migration that was not checked into the repo. This file brings repo and live
-- back in sync; it is a no-op on the live project where the fix already ran.

create or replace function public.calculate_elo_delta(
  p_player_rating integer,
  p_opponent_rating integer,
  p_score numeric,
  p_k_factor integer default 32
)
returns integer
language sql
immutable
set search_path = public
as $$
  select round(
    p_k_factor * (
      p_score - (1.0 / (1.0 + power(10.0, (p_opponent_rating - p_player_rating) / 400.0)))
    )
  )::integer;
$$;
