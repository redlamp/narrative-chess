import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RealtimeMonitor } from "./RealtimeMonitor";

export default async function RealtimeDiagnosticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Realtime + RLS Diagnostic
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Logged in as{" "}
            <code className="text-xs">{user.email}</code> (
            <code className="text-xs">{user.id}</code>)
          </p>
        </div>

        <p className="text-sm text-foreground">
          This page subscribes to <code>public.game_moves</code> for the game ID
          you enter below. Insert a row in Supabase Studio to test that events
          arrive AND the row data is visible (i.e. RLS allows the SELECT that
          Realtime depends on). If events arrive but rows are <code>null</code>
          , RLS is blocking the read — that&apos;s the v1 failure mode this gate
          prevents.
        </p>

        <RealtimeMonitor userId={user.id} />
      </div>
    </main>
  );
}
