-- Role storage column + has_role() helper. See:
--   wiki/notes/decision-role-storage-design.md
--   docs/superpowers/specs/2026-05-12-admin-tooling-and-invite-gate-design.md

-- 1. Add role column with check constraint. Three values:
--    'player'  - default; can play games (current behavior)
--    'admin'   - can access /admin, manage users, nuke data
--    'bot'     - tag for e2e fixture accounts; capabilities identical to player
alter table public.profiles
  add column role text not null default 'player'
  check (role in ('player', 'admin', 'bot'));

-- 2. Partial index on non-player rows. Players never queried by role; admins
--    + bots are. Index size minimal since 99% of rows are 'player'.
create index profiles_role_idx on public.profiles(role) where role <> 'player';

-- 3. SECURITY DEFINER helper - sole role-read surface. All consumers (RLS,
--    RPCs, server actions, page guards) go through this. Never read the
--    role column directly. See decision-role-storage-design.md for why.
create or replace function public.has_role(target text)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = target
  );
$$;

grant execute on function public.has_role(text) to authenticated;

comment on column public.profiles.role is
  'Read only via public.has_role(). Never queried directly. See wiki/notes/decision-role-storage-design.md.';

comment on function public.has_role(text) is
  'Sole role-read surface. All RLS, RPCs, and app code goes through this so the underlying storage can swap (column -> junction table) without touching consumers.';
