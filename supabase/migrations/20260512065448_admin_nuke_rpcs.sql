-- Three /admin destructive operations as SECURITY DEFINER RPCs. See:
--   docs/superpowers/specs/2026-05-12-admin-tooling-and-invite-gate-design.md
-- Each function:
--   1. Verifies the caller has role='admin' via has_role(); else raises 'unauthorized'
--   2. Writes a row to admin_audit BEFORE deleting (defensive)
--   3. Performs deletes in FK-dependency order
--   4. Returns either the count or the list of target uuids (for the server
--      action to loop auth.admin.deleteUser on)


-- =====================================================================
-- admin_nuke_all_games
-- Deletes all game data; preserves users + profiles + invite codes.
-- =====================================================================
create or replace function public.admin_nuke_all_games()
returns int
language plpgsql security definer
as $$
declare
  v_count int;
  v_actor uuid := auth.uid();
begin
  if not public.has_role('admin') then
    raise exception 'unauthorized';
  end if;

  select count(*) into v_count from public.games;

  insert into public.admin_audit (actor_id, action, target_count, details)
  values (v_actor, 'nuke_all_games', v_count, jsonb_build_object(
    'note', 'wipe of all games + moves + observers; users preserved'
  ));

  delete from public.game_observers;
  delete from public.game_moves;
  delete from public.games;

  return v_count;
end;
$$;

revoke execute on function public.admin_nuke_all_games() from public;
grant execute on function public.admin_nuke_all_games() to authenticated;


-- =====================================================================
-- admin_nuke_all_bots
-- Targeted cleanup of e2e/test-fixture accounts (role = 'bot').
-- Returns the uuids of deleted profiles so the server action can finish
-- the job by calling auth.admin.deleteUser on each one.
-- =====================================================================
create or replace function public.admin_nuke_all_bots()
returns setof uuid
language plpgsql security definer
as $$
declare
  v_target_ids uuid[];
  v_count int;
  v_actor uuid := auth.uid();
begin
  if not public.has_role('admin') then
    raise exception 'unauthorized';
  end if;

  select array_agg(user_id)
  into v_target_ids
  from public.profiles
  where role = 'bot';

  v_count := coalesce(array_length(v_target_ids, 1), 0);

  insert into public.admin_audit (actor_id, action, target_count, details)
  values (v_actor, 'nuke_all_bots', v_count, jsonb_build_object(
    'note', 'targeted cleanup of e2e fixture accounts',
    'target_ids', to_jsonb(v_target_ids)
  ));

  if v_count = 0 then
    return;
  end if;

  -- Delete game data for targets. game_moves cascades when games go.
  delete from public.game_observers where user_id = any(v_target_ids);
  delete from public.games
  where white_id = any(v_target_ids) or black_id = any(v_target_ids);

  -- Preserve invite-code rows but unlink the deleted users (audit value).
  update public.invite_codes
  set consumed_by = null,
      consumed_at = null
  where consumed_by = any(v_target_ids);

  delete from public.profiles where user_id = any(v_target_ids);

  return query select unnest(v_target_ids);
end;
$$;

revoke execute on function public.admin_nuke_all_bots() from public;
grant execute on function public.admin_nuke_all_bots() to authenticated;


-- =====================================================================
-- admin_nuke_all_non_admin_users_db_only
-- Broader scope: wipes everyone except admins. Three guards:
--   1. Caller is admin (RLS + this check)
--   2. Caller excluded from target set (belt + suspenders)
--   3. At least one admin remains after delete; else raise
-- DB rows only — server action loops auth.admin.deleteUser on the
-- returned uuids to finish removing auth.users entries.
-- =====================================================================
create or replace function public.admin_nuke_all_non_admin_users_db_only()
returns setof uuid
language plpgsql security definer
as $$
declare
  v_target_ids uuid[];
  v_count int;
  v_actor uuid := auth.uid();
  v_remaining_admins int;
begin
  if not public.has_role('admin') then
    raise exception 'unauthorized';
  end if;

  select array_agg(user_id)
  into v_target_ids
  from public.profiles
  where role in ('player', 'bot')
    and user_id <> v_actor;  -- belt + suspenders: never target self

  v_count := coalesce(array_length(v_target_ids, 1), 0);

  -- Pre-flight: confirm at least one admin survives.
  select count(*) into v_remaining_admins
  from public.profiles
  where role = 'admin'
    and user_id <> all(coalesce(v_target_ids, array[]::uuid[]));

  if v_remaining_admins < 1 then
    raise exception 'would_remove_last_admin';
  end if;

  insert into public.admin_audit (actor_id, action, target_count, details)
  values (v_actor, 'nuke_all_non_admin_users', v_count, jsonb_build_object(
    'note', 'broad reset: deletes role in (player, bot)',
    'target_ids', to_jsonb(v_target_ids),
    'admins_remaining', v_remaining_admins
  ));

  if v_count = 0 then
    return;
  end if;

  delete from public.game_observers where user_id = any(v_target_ids);
  delete from public.games
  where white_id = any(v_target_ids) or black_id = any(v_target_ids);

  update public.invite_codes
  set consumed_by = null,
      consumed_at = null
  where consumed_by = any(v_target_ids);

  delete from public.profiles where user_id = any(v_target_ids);

  return query select unnest(v_target_ids);
end;
$$;

revoke execute on function public.admin_nuke_all_non_admin_users_db_only() from public;
grant execute on function public.admin_nuke_all_non_admin_users_db_only() to authenticated;


-- Quick comments for ledger clarity
comment on function public.admin_nuke_all_games() is
  'Wipes all games + moves + observers. Admin only; raises unauthorized otherwise. Writes admin_audit row before delete.';
comment on function public.admin_nuke_all_bots() is
  'Deletes all profiles with role=bot + their games + observers. Returns target uuids so caller can finish via auth.admin.deleteUser. Admin only.';
comment on function public.admin_nuke_all_non_admin_users_db_only() is
  'Deletes all non-admin profiles + their games + observers. Three guards (admin caller, self-exclude, would_remove_last_admin). Returns target uuids for auth.admin.deleteUser loop.';
