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
   and gt.status in ('invited', 'active', 'completed')
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
      when gt.status = 'invited' then 3
      when gt.status = 'completed' then 4
      else 5
    end,
    case when gt.status = 'completed' then coalesce(gt.last_move_at, gt.updated_at, gt.created_at) end desc nulls last,
    coalesce(gt.deadline_at, gt.last_move_at, gt.updated_at, gt.created_at) asc nulls last,
    gt.updated_at desc;
$$;

revoke all on function public.list_active_games() from public;
grant execute on function public.list_active_games() to authenticated;
