import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName = profile?.display_name ?? "(unknown)";
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString()
    : null;

  return (
    <main className="container mx-auto max-w-xl py-12 px-6 space-y-8">
      <header>
        <h1 className="text-2xl font-heading font-semibold">Account</h1>
        <p className="text-sm text-muted-foreground">
          First-draft account page. Edit-display-name + change-password flows
          land in a follow-up.
        </p>
      </header>

      <section className="space-y-3 rounded border p-4">
        <Field label="Display name" value={displayName} />
        <Field label="Email" value={user.email ?? "(unknown)"} />
        {profile?.username && (
          <Field label="Username" value={profile.username} />
        )}
        {memberSince && <Field label="Member since" value={memberSince} />}
      </section>

      <section className="flex items-center gap-3">
        <Button asChild variant="outline">
          <Link href="/games">Back to games</Link>
        </Button>
        <form action="/auth/logout" method="post">
          <Button type="submit" variant="destructive">
            Sign out
          </Button>
        </form>
      </section>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium truncate">{value}</span>
    </div>
  );
}
