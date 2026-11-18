-- Append-only audit log for /admin destructive operations. See:
--   docs/superpowers/specs/2026-05-12-admin-tooling-and-invite-gate-design.md
-- Written before every nuke action (defensive: if a write fails, we abort
-- before deleting anything). Rendered as a footer on /admin. Never deleted
-- by app code; only manually via SQL if ever needed.

create table public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(user_id),
  action text not null,
  target_count int not null default 0,
  details jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_created_at_idx on public.admin_audit (created_at desc);
create index admin_audit_action_idx on public.admin_audit (action);

alter table public.admin_audit enable row level security;

-- Admins read. No insert/update/delete policies — writes happen via the
-- SECURITY DEFINER nuke RPCs only (next migration). This makes it
-- impossible for any client (even an admin) to forge or rewrite audit
-- rows without going through the audited code path.
create policy admin_audit_admin_select on public.admin_audit
  for select using (public.has_role('admin'));

comment on table public.admin_audit is
  'Append-only audit log. Written by SECURITY DEFINER admin RPCs (admin_nuke_*) before destructive ops. No INSERT/UPDATE/DELETE policies — RLS blocks client writes by default.';
