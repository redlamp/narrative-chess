import { createClient } from "@/lib/supabase/server";
import { AuthHeader } from "./AuthHeader";
import { Hero3DLoader } from "./Hero3DLoader";
import { StatPanels } from "./StatPanels";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative bg-amber-50 dark:bg-zinc-900">
      <Hero3DLoader />
      <AuthHeader authed={!!user} />
      <StatPanels />
    </main>
  );
}
