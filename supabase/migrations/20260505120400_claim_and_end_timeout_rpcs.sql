-- M1.5++ — claim_timeout (player/observer-callable) + end_timeout (service-role)
-- Spec: docs/superpowers/specs/2026-05-05-clocks-timeout-reconnect-design.md §5.4, §5.5

set check_function_bodies = off;

-- Internal helper: shared timeout-end logic, no caller checks.
create or replace function public._end_game_on_timeout(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
  v_active_remaining bigint;
  v_elapsed_ms bigint;
begin
  select * into g from public.games where id = p_game_id for update;

  if not found then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;

  if g.status <> 'in_progress' then
    -- Idempotent: already ended.
    return g;
  end if;

  if g.time_control_type is null or g.turn_started_at is null then
    raise exception 'untimed_game' using errcode = 'P0001';
  end if;

  v_active_remaining := case g.current_turn
    when 'w' then g.white_remaining_ms
    else g.black_remaining_ms
  end;
  v_elapsed_ms := greatest(
    0,
    (extract(epoch from (now() - g.turn_started_at)) * 1000)::bigint - 200
  );

  if v_elapsed_ms <= v_active_remaining then
    raise exception 'not_yet_expired' using errcode = 'P0001';
  end if;

  if g.ply = 0 then
    update public.games
    set status = 'aborted',
        termination_reason = 'abort',
        ended_at = now()
    where id = p_game_id
    returning * into g;
  else
    update public.games
    set status = case g.current_turn when 'w' then 'black_won' else 'white_won' end,
        termination_reason = 'timeout',
        ended_at = now()
    where id = p_game_id
    returning * into g;
  end if;

  return g;
end;
$$;

-- Player / observer claim. Auth required so we trust caller's UID isn't spoofed;
-- math is server-side either way, so any authenticated user can call.
create or replace function public.claim_timeout(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;
  return public._end_game_on_timeout(p_game_id);
end;
$$;

revoke all on function public.claim_timeout(uuid) from public, anon;
grant execute on function public.claim_timeout(uuid) to authenticated;

comment on function public.claim_timeout(uuid) is
  'Anyone authenticated can claim; server validates active-side deadline expired. ply=0 -> abort, else timeout-loss.';

-- Service-role / cron path. Same logic, no auth.uid() check.
create or replace function public.end_timeout(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
begin
  return public._end_game_on_timeout(p_game_id);
end;
$$;

revoke all on function public.end_timeout(uuid) from public, anon, authenticated;
grant execute on function public.end_timeout(uuid) to service_role;

comment on function public.end_timeout(uuid) is
  'Service-role only. Called by daily cron sweep; same math as claim_timeout but skips caller auth.';
