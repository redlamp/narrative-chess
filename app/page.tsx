import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="max-w-md text-center space-y-6">
          <h1 className="text-3xl font-bold text-foreground">Narrative Chess</h1>
          <p className="text-lg text-muted-foreground">
            Chess-first multiplayer game with narrative layers (M2+).
          </p>
          <div className="flex gap-3 justify-center">
            <Button asChild size="lg">
              <Link href="/sign-up">Sign up</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("user_id", user.id)
    .single();

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-3xl font-bold text-foreground">
          Hello, {profile?.display_name ?? user.email}
        </h1>
        <p className="text-sm text-muted-foreground">
          Phase 1+2 verified — auth + profile shell working. M1 game UI ships in Phase 4-5.
        </p>
        <form action="/auth/logout" method="post">
          <Button type="submit" variant="outline" size="lg">
            Log out
          </Button>
        </form>
      </div>
    </main>
  );
}
