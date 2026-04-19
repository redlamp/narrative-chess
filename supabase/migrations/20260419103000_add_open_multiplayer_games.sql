alter table public.game_threads
  add column if not exists is_open boolean not null default false;

create index if not exists game_threads_open_invited_idx
  on public.game_threads (updated_at desc)
  where is_open = true and status = 'invited';

drop function if exists public.create_game_invite(text, text, text, integer, integer, integer, boolean, text);
drop function if exists public.create_game_invite(text, text, text, integer, integer, integer, boolean, text, boolean);
drop function if exists public.join_open_game(uuid);
drop function if exists public.list_active_games();

create or replace function public.create_game_invite(
  p_opponent_username text default null,
  p_city_edition_id text default null,
  p_time_control_kind text default 'move_deadline',
  p_base_seconds integer default null,
  p_increment_seconds integer default 0,
  p_move_deadline_seconds integer default 86400,
  p_rated boolean default false,
  p_creator_side text default 'white',
  p_is_open boolean default false
)
returns table (
  game_id uuid,
  status text,
  time_control_kind text,
  rated boolean,
  city_edition_id text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_creator_username text;
  v_opponent_user_id uuid := null;
  v_game_id uuid;
  v_creator_side text := lower(trim(p_creator_side));
  v_opponent_side text;
  v_start_fen constant text := 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
begin
  if v_user_id is null then
    raise exception 'Sign in to create a multiplayer game.';
  end if;

  if v_creator_side not in ('white', 'black', 'random') then
    raise exception 'Creator side must be white, black, or random.';
  end if;

  if v_creator_side = 'random' then
    v_creator_side := case when random() < 0.5 then 'white' else 'black' end;
  end if;

  v_opponent_side := case when v_creator_side = 'white' then 'black' else 'white' end;

  if p_time_control_kind not in ('live_clock', 'move_deadline') then
    raise exception 'Time control must be live_clock or move_deadline.';
  end if;

  if p_time_control_kind = 'live_clock' and (p_base_seconds is null or p_base_seconds <= 0 or p_increment_seconds < 0) then
    raise exception 'Live clock games need positive base seconds and non-negative increment seconds.';
  end if;

  if p_time_control_kind = 'move_deadline' and (p_move_deadline_seconds is null or p_move_deadline_seconds <= 0) then
    raise exception 'Correspondence games need a move deadline.';
  end if;

  select pr.username
    into v_creator_username
  from public.profiles pr
  where pr.user_id = v_user_id;

  if v_creator_username is null then
    raise exception 'Claim a username before creating multiplayer games.';
  end if;

  if not p_is_open then
    select pr.user_id
      into v_opponent_user_id
    from public.profiles pr
    where pr.username = lower(trim(coalesce(p_opponent_username, '')));

    if v_opponent_user_id is null then
      raise exception 'No player found for that username.';
    end if;

    if v_opponent_user_id = v_user_id then
      raise exception 'You cannot invite yourself.';
    end if;
  end if;

  if p_city_edition_id is not null
    and not exists (
      select 1
      from public.city_versions cv
      where cv.city_edition_id = p_city_edition_id
        and cv.status = 'published'
    ) then
    raise exception 'Choose a published city edition for multiplayer.';
  end if;

  insert into public.game_threads (
    created_by,
    city_edition_id,
    status,
    play_mode,
    time_control_kind,
    base_seconds,
    increment_seconds,
    move_deadline_seconds,
    deadline_at,
    white_seconds_remaining,
    black_seconds_remaining,
    turn_started_at,
    rated,
    is_open,
    current_turn,
    current_fen
  )
  values (
    v_user_id,
    p_city_edition_id,
    'invited',
    case when p_time_control_kind = 'live_clock' then 'sync' else 'async' end,
    p_time_control_kind,
    case when p_time_control_kind = 'live_clock' then p_base_seconds else null end,
    case when p_time_control_kind = 'live_clock' then p_increment_seconds else 0 end,
    case when p_time_control_kind = 'move_deadline' then p_move_deadline_seconds else null end,
    null,
    case when p_time_control_kind = 'live_clock' then p_base_seconds else null end,
    case when p_time_control_kind = 'live_clock' then p_base_seconds else null end,
    null,
    p_rated,
    p_is_open,
    'white',
    v_start_fen
  )
  returning id into v_game_id;

  insert into public.game_participants (game_id, user_id, side, participant_status)
  values (v_game_id, v_user_id, v_creator_side, 'active');

  if not p_is_open then
    insert into public.game_participants (game_id, user_id, side, participant_status)
    values (v_game_id, v_opponent_user_id, v_opponent_side, 'invited');
  end if;

  return query
  select
    gt.id,
    gt.status,
    gt.time_control_kind,
    gt.rated,
    gt.city_edition_id
  from public.game_threads gt
  where gt.id = v_game_id;
end;
$$;

create or replace function public.join_open_game(
  p_game_id uuid
)
returns table (
  game_id uuid,
  status text,
  participant_status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_username text;
  v_thread_status text;
  v_created_by uuid;
  v_time_control_kind text;
  v_move_deadline_seconds integer;
  v_white_seconds_remaining integer;
  v_creator_side text;
  v_joiner_side text;
begin
  if v_user_id is null then
    raise exception 'Sign in to join open multiplayer games.';
  end if;

  select pr.username
    into v_username
  from public.profiles pr
  where pr.user_id = v_user_id;

  if v_username is null then
    raise exception 'Claim a username before joining multiplayer games.';
  end if;

  select
    gt.status,
    gt.created_by,
    gt.time_control_kind,
    gt.move_deadline_seconds,
    gt.white_seconds_remaining,
    creator_gp.side
    into
      v_thread_status,
      v_created_by,
      v_time_control_kind,
      v_move_deadline_seconds,
      v_white_seconds_remaining,
      v_creator_side
  from public.game_threads gt
  join public.game_participants creator_gp
    on creator_gp.game_id = gt.id
   and creator_gp.user_id = gt.created_by
   and creator_gp.participant_status = 'active'
   and creator_gp.side in ('white', 'black')
  where gt.id = p_game_id
    and gt.is_open = true
  for update of gt;

  if v_thread_status is null then
    raise exception 'That open game is not available.';
  end if;

  if v_thread_status <> 'invited' then
    raise exception 'That open game has already started.';
  end if;

  if v_created_by = v_user_id then
    raise exception 'You cannot join your own open game.';
  end if;

  if exists (
    select 1
    from public.game_participants gp
    where gp.game_id = p_game_id
      and gp.user_id = v_user_id
  ) then
    raise exception 'You already joined this game.';
  end if;

  v_joiner_side := case when v_creator_side = 'white' then 'black' else 'white' end;

  insert into public.game_participants (game_id, user_id, side, participant_status)
  values (p_game_id, v_user_id, v_joiner_side, 'active');

  update public.game_threads
  set
    status = 'active',
    is_open = false,
    turn_started_at = now(),
    deadline_at = case
      when v_time_control_kind = 'move_deadline' then now() + make_interval(secs => v_move_deadline_seconds)
      when v_time_control_kind = 'live_clock' then now() + make_interval(secs => v_white_seconds_remaining)
      else null
    end
  where id = p_game_id;

  return query
  select gt.id, gt.status, gp.participant_status
  from public.game_threads gt
  join public.game_participants gp
    on gp.game_id = gt.id
  where gt.id = p_game_id
    and gp.user_id = v_user_id;
end;
$$;

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
  is_outgoing_invite boolean
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
    rows.is_outgoing_invite
  from rows
  order by
    rows.sort_bucket,
    case when rows.status = 'completed' then coalesce(rows.last_move_at, rows.updated_at, rows.created_at) end desc nulls last,
    coalesce(rows.deadline_at, rows.last_move_at, rows.updated_at, rows.created_at) asc nulls last,
    rows.updated_at desc;
$$;

revoke all on function public.create_game_invite(text, text, text, integer, integer, integer, boolean, text, boolean) from public;
grant execute on function public.create_game_invite(text, text, text, integer, integer, integer, boolean, text, boolean) to authenticated;

revoke all on function public.join_open_game(uuid) from public;
grant execute on function public.join_open_game(uuid) to authenticated;

revoke all on function public.list_active_games() from public;
grant execute on function public.list_active_games() to authenticated;
