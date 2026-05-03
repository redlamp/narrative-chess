import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewGameForm } from "./NewGameForm";

export default async function NewGamePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/games/new");

  return (
    <main className="container mx-auto max-w-3xl py-12 px-6 space-y-6">
      <h1 className="text-2xl font-heading font-semibold">New game</h1>
      <p className="text-sm text-muted-foreground">
        Pick a side and create an open challenge. Share the URL with your opponent.
      </p>
      <NewGameForm />
    </main>
  );
}
