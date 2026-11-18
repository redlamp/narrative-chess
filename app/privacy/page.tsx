import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — Narrative Chess",
  description: "What we collect, why, and how to ask for it back.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 space-y-8">
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
          Closed beta
        </p>
        <h1 className="font-display text-4xl tracking-tight text-foreground">
          Privacy
        </h1>
        <p className="text-sm text-muted-foreground">
          Last updated 2026-05-16. This page is the lightweight beta version
          and will be revised before the public launch.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">What we store</h2>
        <ul className="list-disc pl-5 text-sm space-y-1 text-foreground/90">
          <li>Your email and an encrypted hash of your password (Supabase Auth).</li>
          <li>A display name you choose at signup.</li>
          <li>The games you play — every move, timestamp, and outcome.</li>
          <li>Server logs of errors and authentication events for short-term debugging.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">What we don&apos;t store</h2>
        <ul className="list-disc pl-5 text-sm space-y-1 text-foreground/90">
          <li>Payment information — the beta is free.</li>
          <li>Third-party advertising or tracking cookies.</li>
          <li>Anything you type outside the game (no chat, yet).</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Who can see what</h2>
        <p className="text-sm text-foreground/90">
          Your email is visible only to you and to project administrators.
          Your display name, game outcomes, and the moves of finished games
          are visible to other signed-in players. Live games are visible to
          their participants and to anyone who opens the share link.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Deleting your data</h2>
        <p className="text-sm text-foreground/90">
          A self-serve account-delete button is on the roadmap. Until it
          ships, email{" "}
          <a
            href="mailto:taylor@redlamp.org"
            className="text-primary underline-offset-4 hover:underline"
          >
            taylor@redlamp.org
          </a>{" "}
          and your account, profile, and finished games will be deleted
          within seven days.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Contact</h2>
        <p className="text-sm text-foreground/90">
          Questions about this page or your data:{" "}
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
