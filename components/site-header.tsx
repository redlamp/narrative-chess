import { createClient } from "@/lib/supabase/server";
import { SiteHeaderNav } from "./site-header-nav";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();
    displayName = data?.display_name ?? null;
  }

  return <SiteHeaderNav displayName={displayName} />;
}
