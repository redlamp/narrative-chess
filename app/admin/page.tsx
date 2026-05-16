import { redirect } from "next/navigation";
import { hasRole } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatsPanel } from "./components/StatsPanel";
import { UsersTable } from "./components/UsersTable";
import { InviteCodesPanel } from "./components/InviteCodesPanel";
import { DangerZone } from "./components/DangerZone";
import { AuditFooter } from "./components/AuditFooter";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ show_bots?: string }>;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Defense-in-depth: middleware already redirects non-admins. This is the
  // page-level guard that runs even if middleware misses (e.g., during dev
  // mode hot reload, or future matcher regressions).
  if (!(await hasRole("admin"))) {
    redirect("/");
  }

  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  if (!currentUser) redirect("/");

  const { show_bots } = await searchParams;
  const hideBots = show_bots !== "1";

  const admin = createAdminClient();

  // Parallel fetch — every section needs its own data, none depend on each
  // other. List_users pulls the auth.users emails which RLS blocks for
  // anon/authenticated clients (admin client bypasses).
  const [
    profilesRes,
    gamesRes,
    inviteCodesRes,
    auditRes,
    authUsersRes,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("user_id, display_name, role, created_at, updated_at")
      .order("created_at", { ascending: false }),
    admin.from("games").select("id, status, created_at, white_id, black_id"),
    admin
      .from("invite_codes")
      .select("code, created_by, created_at, expires_at, consumed_by, consumed_at, note")
      .order("created_at", { ascending: false }),
    admin
      .from("admin_audit")
      .select("id, actor_id, action, target_count, details, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    admin.auth.admin.listUsers({ perPage: 200 }),
  ]);

  const profiles = profilesRes.data ?? [];
  const games = gamesRes.data ?? [];
  const inviteCodes = inviteCodesRes.data ?? [];
  const audit = auditRes.data ?? [];
  const authUsers = authUsersRes.data?.users ?? [];

  // Stitch email onto profiles via auth.users lookup.
  const emailById = new Map(authUsers.map((u) => [u.id, u.email ?? ""]));
  const users = profiles.map((p) => ({
    ...p,
    email: emailById.get(p.user_id) ?? "(unknown)",
  }));

  // Compute games-played per user for the table.
  const playCount = new Map<string, number>();
  for (const g of games) {
    if (g.white_id) playCount.set(g.white_id, (playCount.get(g.white_id) ?? 0) + 1);
    if (g.black_id) playCount.set(g.black_id, (playCount.get(g.black_id) ?? 0) + 1);
  }
  const usersWithCounts = users.map((u) => ({
    ...u,
    games_played: playCount.get(u.user_id) ?? 0,
  }));

  // Server render time. Passed down to client panels that need "now" for
  // expired-code detection + weekly-window stats; avoids the
  // react-hooks/purity lint trigger in those leaf components.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-10">
      <header className="space-y-1">
        <h1 className="font-display text-4xl tracking-tight text-foreground">
          Admin{" "}
          <em
            className="font-display italic"
            style={{ color: "var(--oxblood)" }}
          >
            console
          </em>
        </h1>
        <p className="text-sm text-muted-foreground">
          Closed-beta tooling. Bot accounts hidden by default; toggle below.
        </p>
      </header>

      <StatsPanel
        users={usersWithCounts}
        games={games}
        inviteCodes={inviteCodes}
        nowMs={nowMs}
      />

      <UsersTable
        users={usersWithCounts}
        hideBots={hideBots}
        currentUserId={currentUser.id}
      />

      <InviteCodesPanel
        codes={inviteCodes}
        userEmailById={emailById}
        nowMs={nowMs}
      />

      <DangerZone />

      <AuditFooter
        audit={audit}
        actorEmailById={Object.fromEntries(emailById)}
      />
    </div>
  );
}
