import { StageCtas } from "./StageCtas";

type Props = { authed: boolean };

/**
 * Editorial overlay that sits on top of the 3D stage canvas. Constrained
 * to the LEFT half so the right-side piece cluster on the plinth stays
 * unobstructed. Two type voices: humanist Fraunces for the headline + deck,
 * mono JetBrains for the secondary CTA. The italic "that tell" line uses
 * oxblood for the only narrative-voice color accent.
 */
export function StageOverlay({ authed }: Props) {
  return (
    <div className="relative z-10 h-full max-w-[1180px] mx-auto px-14 pt-10 pb-14 grid grid-rows-[1fr_auto] pointer-events-none">
      <div />
      <div className="self-end max-w-[38ch] pointer-events-auto">
        <h1
          className="font-display font-[360] leading-[0.96] tracking-[-0.022em] text-foreground"
          style={{
            fontVariationSettings: '"opsz" 144, "SOFT" 50, "WONK" 0',
            fontSize: "clamp(40px, 5.4vw, 76px)",
          }}
        >
          Games
          <br />
          <em
            style={{
              fontStyle: "italic",
              fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1',
              color: "var(--oxblood)",
              fontWeight: 320,
            }}
          >
            that tell
          </em>
          <br />
          stories.
        </h1>

        <p className="mt-4 font-body italic font-[320] text-[17px] leading-[1.45] text-ink-soft">
          Two players sit. A board opens. Somewhere between move 1 and the
          resignation, a story arrives — and the engine quietly records it.
        </p>

        <StageCtas authed={authed} />
      </div>
    </div>
  );
}
