import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/server";
import { AuthHeader } from "./AuthHeader";

const Hero3D = dynamic(() => import("./Hero3D"), { ssr: false });

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative min-h-[calc(100vh-3rem)] overflow-hidden bg-amber-100 dark:bg-zinc-900">
      <AuthHeader authed={!!user} />
      <Hero3D />
    </main>
  );
}
