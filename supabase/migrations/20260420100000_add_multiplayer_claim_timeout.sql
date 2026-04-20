create or replace function public.claim_game_timeout(
  p_game_id uuid
)
returns table (
  game_id uuid,
  status text,
  result text,
  current_turn text,
  deadline_at timestamptz,
  completed_at timestamptz,
  white_rating_delta integer,
  black_rating_delta integer
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_side text;
  v_thread_status text;
  v_current_turn text;
  v_deadline_at timestamptz;
  v_is_rated boolean;
  v_rating_applied_at timestamptz;
  v_white_user_id uuid;
  v_black_user_id uuid;
  v_white_rating integer;
  v_black_rating integer;
  v_white_score numeric;
  v_black_score numeric;
  v_white_delta integer := null;
  v_black_delta integer := null;
  v_result text;
begin
  if v_user_id is null then
    raise exception 'Sign in to claim multiplayer timeouts.';
  end if;

  select
    gp.side,
    gt.status,
    gt.current_turn,
    gt.deadline_at,
    gt.rated,
    gt.rating_applied_at
    into
      v_side,
      v_thread_status,
      v_current_turn,
      v_deadline_at,
      v_is_rated,
      v_rating_applied_at
  from public.game_threads gt
  join public.game_participants gp
    on gp.game_id = gt.id
  where gt.id = p_game_id
    and gp.user_id = v_user_id
    and gp.participant_status = 'active'
    and gp.side in ('white', 'black')
  for update of gt, gp;

  if v_side is null then
    raise exception 'That multiplayer game is not available for this account.';
  end if;

  if v_thread_status <> 'active' then
    raise exception 'Only active multiplayer games can be timed out.';
  end if;

  if v_current_turn is null then
    raise exception 'This game has no active turn to time out.';
  end if;

  if v_current_turn = v_side then
    raise exception 'You cannot claim a timeout on your own turn.';
  end if;

  if v_deadline_at is null then
    raise exception 'This game has no timeout deadline to enforce.';
  end if;

  if v_now < v_deadline_at then
    raise exception 'This game has not timed out yet.';
  end if;

  v_result := v_side;

  if v_is_rated and v_rating_applied_at is null then
    select
      max(case when gp.side = 'white' then gp.user_id end),
      max(case when gp.side = 'black' then gp.user_id end)
      into v_white_user_id, v_black_user_id
    from public.game_participants gp
    where gp.game_id = p_game_id
      and gp.side in ('white', 'black');

    if v_white_user_id is not null then
      insert into public.profiles (user_id)
      values (v_white_user_id)
      on conflict (user_id) do nothing;
    end if;

    if v_black_user_id is not null then
      insert into public.profiles (user_id)
      values (v_black_user_id)
      on conflict (user_id) do nothing;
    end if;

    if v_white_user_id is not null and v_black_user_id is not null then
      select p.elo_rating into v_white_rating
      from public.profiles p
      where p.user_id = v_white_user_id;

      select p.elo_rating into v_black_rating
      from public.profiles p
      where p.user_id = v_black_user_id;

      if v_result = 'white' then
        v_white_score := 1;
        v_black_score := 0;
      else
        v_white_score := 0;
        v_black_score := 1;
      end if;

      v_white_delta := public.calculate_elo_delta(v_white_rating, v_black_rating, v_white_score);
      v_black_delta := public.calculate_elo_delta(v_black_rating, v_white_rating, v_black_score);

      update public.profiles
      set elo_rating = elo_rating + v_white_delta
      where user_id = v_white_user_id;

      update public.profiles
      set elo_rating = elo_rating + v_black_delta
      where user_id = v_black_user_id;
    end if;
  end if;

  update public.game_threads
  set
    status = 'completed',
    result = v_result,
    winner_user_id = v_user_id,
    completed_at = v_now,
    last_move_at = coalesce(last_move_at, v_now),
    current_turn = null,
    turn_started_at = null,
    deadline_at = null,
    rating_applied_at = case
      when v_is_rated and v_rating_applied_at is null then v_now
      else rating_applied_at
    end,
    white_rating_delta = case
      when v_is_rated and v_rating_applied_at is null then v_white_delta
      else white_rating_delta
    end,
    black_rating_delta = case
      when v_is_rated and v_rating_applied_at is null then v_black_delta
      else black_rating_delta
    end
  where id = p_game_id;

  return query
  select
    gt.id,
    gt.status,
    gt.result,
    gt.current_turn,
    gt.deadline_at,
    gt.completed_at,
    gt.white_rating_delta,
    gt.black_rating_delta
  from public.game_threads gt
  where gt.id = p_game_id;
end;
$$;

revoke all on function public.claim_game_timeout(uuid) from public;
grant execute on function public.claim_game_timeout(uuid) to authenticated;

drop function if exists public.list_active_games();

create or replace function public.list_active_games()
returns table (
  game_id uuid,
  status text,
  time_control_kind text,
  base_seconds integer,
  increment_seconds integer,
  move_deadline_seconds integer,
  deadline_at timestamptz,
  white_seconds_remaining integer,
  black_seconds_remaining integer,
  turn_started_at timestamptz,
  rated boolean,
  result text,
  white_rating_delta integer,
  black_rating_delta integer,
  city_edition_id text,
  city_label text,
  created_at timestamptz,
  updated_at timestamptz,
  last_move_at timestamptz,
  current_turn text,
  your_side text,
  your_participant_status text,
  opponent_user_id uuid,
  opponent_username text,
  opponent_display_name text,
  opponent_elo_rating integer,
  opponent_participant_status text,
  is_open_game boolean,
  can_join_open_game boolean,
  is_your_turn boolean,
  is_incoming_invite boolean,
  is_outgoing_invite boolean,
  is_timed_out boolean,
  can_claim_timeout boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with me as (
    select auth.uid() as user_id
  ),
  rows as (
    select
      gt.id as game_id,
      gt.status,
      gt.time_control_kind,
      gt.base_seconds,
      gt.increment_seconds,
      gt.move_deadline_seconds,
      gt.deadline_at,
      gt.white_seconds_remaining,
      gt.black_seconds_remaining,
      gt.turn_started_at,
      gt.rated,
      gt.result,
      gt.white_rating_delta,
      gt.black_rating_delta,
      gt.city_edition_id,
      ce.label as city_label,
      gt.created_at,
      gt.updated_at,
      gt.last_move_at,
      gt.current_turn,
      self_gp.side as your_side,
      self_gp.participant_status as your_participant_status,
      opponent_gp.user_id as opponent_user_id,
      opponent_profile.username as opponent_username,
      opponent_profile.display_name as opponent_display_name,
      coalesce(opponent_profile.elo_rating, 1200) as opponent_elo_rating,
      opponent_gp.participant_status as opponent_participant_status,
      gt.is_open as is_open_game,
      false as can_join_open_game,
      (
        gt.status = 'active'
        and self_gp.participant_status = 'active'
        and gt.current_turn = self_gp.side
      ) as is_your_turn,
      (
        gt.status = 'invited'
        and self_gp.participant_status = 'invited'
        and gt.created_by <> me.user_id
      ) as is_incoming_invite,
      (
        gt.status = 'invited'
        and gt.created_by = me.user_id
      ) as is_outgoing_invite,
      (
        gt.status = 'active'
        and gt.current_turn is not null
        and gt.deadline_at is not null
        and gt.deadline_at <= now()
      ) as is_timed_out,
      (
        gt.status = 'active'
        and self_gp.participant_status = 'active'
        and self_gp.side in ('white', 'black')
        and gt.current_turn is not null
        and gt.current_turn <> self_gp.side
        and gt.deadline_at is not null
        and gt.deadline_at <= now()
      ) as can_claim_timeout,
      case
        when gt.status = 'invited' and self_gp.participant_status = 'invited' and gt.created_by <> me.user_id then 0
        when gt.status = 'active' and gt.current_turn = self_gp.side then 1
        when gt.status = 'active' then 2
        when gt.status = 'invited' then 4
        when gt.status = 'completed' then 5
        else 6
      end as sort_bucket
    from me
    join public.game_participants self_gp
      on self_gp.user_id = me.user_id
     and self_gp.participant_status in ('invited', 'active')
    join public.game_threads gt
      on gt.id = self_gp.game_id
     and gt.status in ('invited', 'active', 'completed')
    left join public.game_participants opponent_gp
      on opponent_gp.game_id = gt.id
     and opponent_gp.user_id <> me.user_id
     and opponent_gp.side in ('white', 'black')
    left join public.profiles opponent_profile
      on opponent_profile.user_id = opponent_gp.user_id
    left join public.city_editions ce
      on ce.id = gt.city_edition_id

    union all

    select
      gt.id as game_id,
      gt.status,
      gt.time_control_kind,
      gt.base_seconds,
      gt.increment_seconds,
      gt.move_deadline_seconds,
      gt.deadline_at,
      gt.white_seconds_remaining,
      gt.black_seconds_remaining,
      gt.turn_started_at,
      gt.rated,
      gt.result,
      gt.white_rating_delta,
      gt.black_rating_delta,
      gt.city_edition_id,
      ce.label as city_label,
      gt.created_at,
      gt.updated_at,
      gt.last_move_at,
      gt.current_turn,
      'spectator'::text as your_side,
      'invited'::text as your_participant_status,
      gt.created_by as opponent_user_id,
      creator_profile.username as opponent_username,
      creator_profile.display_name as opponent_display_name,
      coalesce(creator_profile.elo_rating, 1200) as opponent_elo_rating,
      'active'::text as opponent_participant_status,
      true as is_open_game,
      true as can_join_open_game,
      false as is_your_turn,
      false as is_incoming_invite,
      false as is_outgoing_invite,
      false as is_timed_out,
      false as can_claim_timeout,
      3 as sort_bucket
    from me
    join public.game_threads gt
      on gt.status = 'invited'
     and gt.is_open = true
     and gt.created_by <> me.user_id
    join public.game_participants creator_gp
      on creator_gp.game_id = gt.id
     and creator_gp.user_id = gt.created_by
     and creator_gp.participant_status = 'active'
     and creator_gp.side in ('white', 'black')
    left join public.profiles creator_profile
      on creator_profile.user_id = gt.created_by
    left join public.city_editions ce
      on ce.id = gt.city_edition_id
    where not exists (
      select 1
      from public.game_participants gp
      where gp.game_id = gt.id
        and gp.user_id = me.user_id
    )
  )
  select
    rows.game_id,
    rows.status,
    rows.time_control_kind,
    rows.base_seconds,
    rows.increment_seconds,
    rows.move_deadline_seconds,
    rows.deadline_at,
    rows.white_seconds_remaining,
    rows.black_seconds_remaining,
    rows.turn_started_at,
    rows.rated,
    rows.result,
    rows.white_rating_delta,
    rows.black_rating_delta,
    rows.city_edition_id,
    rows.city_label,
    rows.created_at,
    rows.updated_at,
    rows.last_move_at,
    rows.current_turn,
    rows.your_side,
    rows.your_participant_status,
    rows.opponent_user_id,
    rows.opponent_username,
    rows.opponent_display_name,
    rows.opponent_elo_rating,
    rows.opponent_participant_status,
    rows.is_open_game,
    rows.can_join_open_game,
    rows.is_your_turn,
    rows.is_incoming_invite,
    rows.is_outgoing_invite,
    rows.is_timed_out,
    rows.can_claim_timeout
  from rows
  order by
    case when rows.can_claim_timeout then 0 else 1 end,
    rows.sort_bucket,
    case when rows.status = 'completed' then coalesce(rows.last_move_at, rows.updated_at, rows.created_at) end desc nulls last,
    coalesce(rows.deadline_at, rows.last_move_at, rows.updated_at, rows.created_at) asc nulls last,
    rows.updated_at desc;
$$;

revoke all on function public.list_active_games() from public;
grant execute on function public.list_active_games() to authenticated;
