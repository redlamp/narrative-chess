import { createClient } from "@/lib/supabase/server";
import { AuthHeader } from "./AuthHeader";
import { Hero3DLoader } from "./Hero3DLoader";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative min-h-[calc(100vh-3rem)] overflow-hidden bg-amber-50 dark:bg-zinc-900">
      <AuthHeader authed={!!user} />
      <Hero3DLoader />
    </main>
  );
}
