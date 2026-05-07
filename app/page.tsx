import { createClient } from "@/lib/supabase/server";
import { Hero3DLoader } from "./Hero3DLoader";
import { StageOverlay } from "./StageOverlay";
import { StatPanels } from "./StatPanels";
import { LiveGameCard } from "./LiveGameCard";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      {/* Stage — 3D hero behind editorial overlay. Hero3D renders absolute
          inset-0 inside this section; StageOverlay sits z-10 on top. */}
      <section
        className="relative w-full h-[60vh] min-h-[460px] overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, var(--scene-bg-top) 0%, var(--scene-bg-bot) 100%)",
        }}
      >
        <Hero3DLoader />
        <StageOverlay authed={!!user} />
        {/* Subtle vignette + paper-grain — bridges 3D back to editorial palette. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-multiply"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.18) 100%), repeating-linear-gradient(45deg, rgba(0,0,0,0.012) 0 1px, transparent 1px 3px)",
          }}
        />
      </section>

      {/* Frame — editorial flow below stage. */}
      <main className="max-w-[1180px] mx-auto px-14 pt-16 pb-24">
        <LiveGameCard />
        <StatPanels />
      </main>
    </>
  );
}
