import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms — Narrative Chess",
  description: "What you can expect from the beta, and what we expect from you.",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 space-y-8">
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
          Closed beta
        </p>
        <h1 className="font-display text-4xl tracking-tight text-foreground">
          Terms
        </h1>
        <p className="text-sm text-muted-foreground">
          Last updated 2026-05-16. Plain-language beta terms — a fuller
          version will land before the public launch.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Beta status</h2>
        <p className="text-sm text-foreground/90">
          Narrative Chess is in a closed-invite beta. The service can change
          shape, pause, or reset its data at any time. Expect bugs. Report
          them and they will be fixed.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Your account</h2>
        <ul className="list-disc pl-5 text-sm space-y-1 text-foreground/90">
          <li>Sign up with a real email and a display name that other players will see.</li>
          <li>You are responsible for keeping your password to yourself.</li>
          <li>Share the invite code carefully — codes can be revoked.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Conduct</h2>
        <p className="text-sm text-foreground/90">
          Don&apos;t pick a display name that is slurring, impersonating, or
          designed to embarrass another player. Don&apos;t use external
          engines or computer assistance during your games. Both behaviours
          are grounds for account removal without warning.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">No warranty</h2>
        <p className="text-sm text-foreground/90">
          The beta is provided as-is with no guarantee of uptime, accuracy,
          or game-history preservation. We will try to do better than that —
          but during the beta, treat any single rating, record, or game-log
          as best-effort.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Contact</h2>
        <p className="text-sm text-foreground/90">
          Questions or report a violation:{" "}
          <a
            href="mailto:taylor@redlamp.org"
            className="text-primary underline-offset-4 hover:underline"
          >
            taylor@redlamp.org
          </a>
          .
        </p>
      </section>
    </article>
  );
}
