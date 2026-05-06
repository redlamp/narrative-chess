-- Public stats RPC for the home page promo panels.
--
-- SECURITY DEFINER so anon (signed-out) visitors can hit it; the function
-- only returns aggregated counts and never exposes row contents, so RLS
-- bypass is safe by design.

set check_function_bodies = off;

create or replace function public.public_stats()
returns table (
  games_played bigint,
  active_games bigint,
  accounts bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    (select count(*)::bigint from public.games
       where status in ('white_won','black_won','draw','aborted'))
       as games_played,
    (select count(*)::bigint from public.games
       where status = 'in_progress')
       as active_games,
    (select count(*)::bigint from public.profiles)
       as accounts;
end;
$$;

revoke all on function public.public_stats() from public;
grant execute on function public.public_stats() to anon, authenticated;

comment on function public.public_stats() is
  'Aggregated counts for the home-page promo panels. Returns games-played, active-games, accounts. No row exposure; safe for anon.';
