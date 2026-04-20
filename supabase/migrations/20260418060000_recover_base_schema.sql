-- Recover the base schema that the live Supabase project already had when the
-- rest of the repo migrations were authored but was not itself checked in.
-- Flagged as P0 in docs/supabase-rls-checklist.md ("Version-Control Missing
-- Base Security Objects"). This migration is fully idempotent so it is safe to
-- re-apply against the live project; on a fresh Supabase it provides the
-- foundation (shared updated-at trigger, city identity tables, user roles, and
-- the role-check + first-admin bootstrap helpers) that every later migration
-- in the repo depends on.

-- ---------- shared helpers ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- cities ----------

create table if not exists public.cities (
  id text primary key,
  slug text not null unique,
  name text not null,
  country text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_cities_updated_at on public.cities;
create trigger set_cities_updated_at
  before update on public.cities
  for each row execute function public.set_updated_at();

alter table public.cities enable row level security;

-- ---------- city_editions ----------

create table if not exists public.city_editions (
  id text primary key,
  city_id text not null references public.cities(id) on delete cascade,
  slug text not null unique,
  label text not null,
  time_period text,
  theme text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint city_editions_city_label_unique unique (city_id, label)
);

create index if not exists city_editions_city_id_idx on public.city_editions (city_id);

create unique index if not exists city_editions_one_default_per_city_idx
  on public.city_editions (city_id)
  where is_default = true;

drop trigger if exists set_city_editions_updated_at on public.city_editions;
create trigger set_city_editions_updated_at
  before update on public.city_editions
  for each row execute function public.set_updated_at();

alter table public.city_editions enable row level security;

-- ---------- city_versions ----------

create table if not exists public.city_versions (
  id uuid primary key default gen_random_uuid(),
  city_edition_id text not null references public.city_editions(id) on delete cascade,
  version_number integer not null,
  status text not null check (status in ('draft', 'published', 'archived')),
  content_status text not null default 'empty'
    check (content_status in ('empty', 'procedural', 'authored')),
  review_status text not null default 'empty'
    check (review_status in ('empty', 'needs review', 'reviewed', 'approved')),
  payload jsonb not null,
  review_notes text,
  last_reviewed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  notes text,
  constraint city_versions_edition_version_unique unique (city_edition_id, version_number)
);

create index if not exists city_versions_city_edition_id_idx on public.city_versions (city_edition_id);
create index if not exists city_versions_city_edition_status_idx on public.city_versions (city_edition_id, status);
create index if not exists city_versions_created_at_idx on public.city_versions (created_at desc);

create unique index if not exists city_versions_one_published_per_edition_idx
  on public.city_versions (city_edition_id)
  where status = 'published';

drop trigger if exists set_city_versions_updated_at on public.city_versions;
create trigger set_city_versions_updated_at
  before update on public.city_versions
  for each row execute function public.set_updated_at();

alter table public.city_versions enable row level security;

-- ---------- user_roles ----------

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('author', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_user_roles_updated_at on public.user_roles;
create trigger set_user_roles_updated_at
  before update on public.user_roles
  for each row execute function public.set_updated_at();

alter table public.user_roles enable row level security;

-- ---------- role helpers ----------

create or replace function public.has_app_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles user_role
    where user_role.user_id = auth.uid()
      and (user_role.role = required_role or user_role.role = 'admin')
  );
$$;

revoke all on function public.has_app_role(text) from public;
grant execute on function public.has_app_role(text) to authenticated;

create or replace function public.bootstrap_first_admin()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtext('bootstrap_first_admin'));

  if exists (select 1 from public.user_roles) then
    return null;
  end if;

  insert into public.user_roles (user_id, role)
  values (current_user_id, 'admin')
  on conflict (user_id) do update
  set role = excluded.role,
      updated_at = now();

  return 'admin';
end;
$$;

revoke all on function public.bootstrap_first_admin() from public;
grant execute on function public.bootstrap_first_admin() to authenticated;

-- ---------- initial RLS policies ----------
-- Policies mirror the live state at the time the rest of the repo migrations
-- were authored. Later migrations (for example the consolidation + initplan
-- optimization pass) can drop and recreate them without touching this file.

drop policy if exists "public can read cities" on public.cities;
create policy "public can read cities"
  on public.cities
  for select
  to public
  using (true);

drop policy if exists "authors can insert cities" on public.cities;
create policy "authors can insert cities"
  on public.cities
  for insert
  to authenticated
  with check (public.has_app_role('author'));

drop policy if exists "authors can update cities" on public.cities;
create policy "authors can update cities"
  on public.cities
  for update
  to authenticated
  using (public.has_app_role('author'))
  with check (public.has_app_role('author'));

drop policy if exists "public can read city editions" on public.city_editions;
create policy "public can read city editions"
  on public.city_editions
  for select
  to public
  using (true);

drop policy if exists "authors can insert city editions" on public.city_editions;
create policy "authors can insert city editions"
  on public.city_editions
  for insert
  to authenticated
  with check (public.has_app_role('author'));

drop policy if exists "authors can update city editions" on public.city_editions;
create policy "authors can update city editions"
  on public.city_editions
  for update
  to authenticated
  using (public.has_app_role('author'))
  with check (public.has_app_role('author'));

drop policy if exists "public can read published city versions" on public.city_versions;
create policy "public can read published city versions"
  on public.city_versions
  for select
  to public
  using (status = 'published');

drop policy if exists "authors can read all city versions" on public.city_versions;
create policy "authors can read all city versions"
  on public.city_versions
  for select
  to authenticated
  using (public.has_app_role('author'));

drop policy if exists "authors can insert city versions" on public.city_versions;
create policy "authors can insert city versions"
  on public.city_versions
  for insert
  to authenticated
  with check (public.has_app_role('author'));

drop policy if exists "authors can update city versions" on public.city_versions;
create policy "authors can update city versions"
  on public.city_versions
  for update
  to authenticated
  using (public.has_app_role('author'))
  with check (public.has_app_role('author'));

drop policy if exists "users can read own role" on public.user_roles;
create policy "users can read own role"
  on public.user_roles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "admins can read all user roles" on public.user_roles;
create policy "admins can read all user roles"
  on public.user_roles
  for select
  to authenticated
  using (public.has_app_role('admin'));

drop policy if exists "admins can insert user roles" on public.user_roles;
create policy "admins can insert user roles"
  on public.user_roles
  for insert
  to authenticated
  with check (public.has_app_role('admin'));

drop policy if exists "admins can update user roles" on public.user_roles;
create policy "admins can update user roles"
  on public.user_roles
  for update
  to authenticated
  using (public.has_app_role('admin'))
  with check (public.has_app_role('admin'));
