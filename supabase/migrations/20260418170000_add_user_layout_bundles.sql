create table if not exists public.user_layout_bundles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bundle_name text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_layout_bundles_user_name_unique unique (user_id, bundle_name)
);

alter table public.user_layout_bundles enable row level security;

drop trigger if exists set_user_layout_bundles_updated_at on public.user_layout_bundles;
create trigger set_user_layout_bundles_updated_at
before update on public.user_layout_bundles
for each row
execute function public.set_updated_at();

create policy "users can read their own layout bundles"
on public.user_layout_bundles
for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert their own layout bundles"
on public.user_layout_bundles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can update their own layout bundles"
on public.user_layout_bundles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
