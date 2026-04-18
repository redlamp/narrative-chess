alter table public.game_threads
  add column if not exists time_control_kind text,
  add column if not exists base_seconds integer,
  add column if not exists increment_seconds integer not null default 0,
  add column if not exists move_deadline_seconds integer,
  add column if not exists deadline_at timestamptz;

update public.game_threads
set
  time_control_kind = case
    when play_mode = 'sync' then 'live_clock'
    else 'move_deadline'
  end,
  base_seconds = case
    when play_mode = 'sync' then coalesce(base_seconds, 600)
    else null
  end,
  increment_seconds = case
    when play_mode = 'sync' then coalesce(increment_seconds, 0)
    else 0
  end,
  move_deadline_seconds = case
    when play_mode = 'async' then coalesce(move_deadline_seconds, 86400)
    else null
  end,
  deadline_at = case
    when play_mode = 'async' and status = 'active'
      then coalesce(deadline_at, coalesce(last_move_at, updated_at, created_at) + make_interval(secs => coalesce(move_deadline_seconds, 86400)))
    else deadline_at
  end
where time_control_kind is null;

alter table public.game_threads
  alter column time_control_kind set default 'move_deadline';

update public.game_threads
set time_control_kind = 'move_deadline'
where time_control_kind is null;

alter table public.game_threads
  alter column time_control_kind set not null;

alter table public.game_threads
  drop constraint if exists game_threads_time_control_kind_check;

alter table public.game_threads
  add constraint game_threads_time_control_kind_check
  check (time_control_kind in ('live_clock', 'move_deadline'));

alter table public.game_threads
  drop constraint if exists game_threads_time_control_shape_check;

alter table public.game_threads
  add constraint game_threads_time_control_shape_check
  check (
    (
      time_control_kind = 'live_clock'
      and base_seconds is not null
      and base_seconds > 0
      and increment_seconds >= 0
      and move_deadline_seconds is null
    )
    or
    (
      time_control_kind = 'move_deadline'
      and move_deadline_seconds is not null
      and move_deadline_seconds > 0
      and base_seconds is null
      and increment_seconds = 0
    )
  );

create index if not exists game_threads_deadline_idx
  on public.game_threads (deadline_at asc)
  where deadline_at is not null;

drop function if exists public.create_game_invite(text, text, text, boolean);
drop function if exists public.list_active_games();

create or replace function public.create_game_invite(
  p_opponent_username text,
  p_city_edition_id text default null,
  p_time_control_kind text default 'move_deadline',
  p_base_seconds integer default null,
  p_increment_seconds integer default 0,
  p_move_deadline_seconds integer default 86400,
  p_rated boolean default false
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
  v_opponent_user_id uuid;
  v_game_id uuid;
  v_start_fen constant text := 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
begin
  if v_user_id is null then
    raise exception 'Sign in to create a multiplayer game.';
  end if;

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

  select pr.user_id
    into v_opponent_user_id
  from public.profiles pr
  where pr.username = lower(trim(p_opponent_username));

  if v_opponent_user_id is null then
    raise exception 'No player found for that username.';
  end if;

  if v_opponent_user_id = v_user_id then
    raise exception 'You cannot invite yourself.';
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
    rated,
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
    p_rated,
    'white',
    v_start_fen
  )
  returning id into v_game_id;

  insert into public.game_participants (game_id, user_id, side, participant_status)
  values
    (v_game_id, v_user_id, 'white', 'active'),
    (v_game_id, v_opponent_user_id, 'black', 'invited');

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

create or replace function public.respond_to_game_invite(
  p_game_id uuid,
  p_response text
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
  v_thread_status text;
  v_participant_status text;
  v_time_control_kind text;
  v_move_deadline_seconds integer;
begin
  if v_user_id is null then
    raise exception 'Sign in to respond to multiplayer invites.';
  end if;

  if p_response not in ('accept', 'decline') then
    raise exception 'Invite response must be accept or decline.';
  end if;

  select gt.status, gp.participant_status, gt.time_control_kind, gt.move_deadline_seconds
    into v_thread_status, v_participant_status, v_time_control_kind, v_move_deadline_seconds
  from public.game_threads gt
  join public.game_participants gp
    on gp.game_id = gt.id
  where gt.id = p_game_id
    and gp.user_id = v_user_id
  for update of gt, gp;

  if v_thread_status is null then
    raise exception 'That multiplayer invite is not available.';
  end if;

  if v_thread_status <> 'invited' or v_participant_status <> 'invited' then
    raise exception 'That multiplayer invite has already been resolved.';
  end if;

  if p_response = 'accept' then
    update public.game_participants
    set participant_status = 'active'
    where game_id = p_game_id
      and user_id = v_user_id;

    update public.game_threads
    set
      status = 'active',
      deadline_at = case
        when v_time_control_kind = 'move_deadline' then now() + make_interval(secs => v_move_deadline_seconds)
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
    return;
  end if;

  update public.game_participants
  set participant_status = 'declined'
  where game_id = p_game_id
    and user_id = v_user_id;

  update public.game_threads
  set
    status = 'cancelled',
    result = 'cancelled',
    completed_at = now(),
    current_turn = null,
    deadline_at = null
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
  rated boolean,
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
  )
  select
    gt.id as game_id,
    gt.status,
    gt.time_control_kind,
    gt.base_seconds,
    gt.increment_seconds,
    gt.move_deadline_seconds,
    gt.deadline_at,
    gt.rated,
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
    ) as is_outgoing_invite
  from me
  join public.game_participants self_gp
    on self_gp.user_id = me.user_id
   and self_gp.participant_status in ('invited', 'active')
  join public.game_threads gt
    on gt.id = self_gp.game_id
   and gt.status in ('invited', 'active')
  left join public.game_participants opponent_gp
    on opponent_gp.game_id = gt.id
   and opponent_gp.user_id <> me.user_id
   and opponent_gp.side in ('white', 'black')
  left join public.profiles opponent_profile
    on opponent_profile.user_id = opponent_gp.user_id
  left join public.city_editions ce
    on ce.id = gt.city_edition_id
  order by
    case
      when gt.status = 'invited' and self_gp.participant_status = 'invited' and gt.created_by <> me.user_id then 0
      when gt.status = 'active' and gt.current_turn = self_gp.side then 1
      when gt.status = 'active' then 2
      else 3
    end,
    coalesce(gt.deadline_at, gt.last_move_at, gt.updated_at, gt.created_at) asc nulls last,
    gt.updated_at desc;
$$;

revoke all on function public.create_game_invite(text, text, text, integer, integer, integer, boolean) from public;
grant execute on function public.create_game_invite(text, text, text, integer, integer, integer, boolean) to authenticated;

revoke all on function public.list_active_games() from public;
grant execute on function public.list_active_games() to authenticated;
