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
      <header className="space-y-2">
        <h1 className="font-display text-3xl tracking-tight text-foreground">
          New{" "}
          <em
            className="font-display italic"
            style={{ color: "var(--oxblood)" }}
          >
            game
          </em>
        </h1>
        <p className="font-body italic text-sm text-ink-soft">
          Pick a side and create an open challenge. Share the URL with your opponent.
        </p>
      </header>
      <NewGameForm />
    </main>
  );
}
