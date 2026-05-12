-- Promote Taylor's account to admin. Idempotent - re-runs are no-ops.
-- UUID hardcoded per wiki/projects/narrative-chess-v2.md.
-- After this lands, role grants flow through /admin UI.
update public.profiles
set role = 'admin'
where user_id = '14e5b50b-3757-4ae7-8bcb-00aecdc57580';
