"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthDialog } from "./AuthDialog";

type Props = { authed: boolean };

const PRIMARY_CTA =
  "inline-flex items-center px-6 py-3 bg-foreground text-background border border-foreground font-display italic font-[380] text-[16px] hover:bg-oxblood hover:border-oxblood transition-colors";
const PRIMARY_ARROW =
  "font-mono not-italic font-medium text-[12px] ml-3 opacity-70";
const SECONDARY_CTA =
  "inline-flex items-center px-4 py-3 bg-transparent text-foreground border border-rule font-mono text-[11px] tracking-[0.18em] uppercase hover:bg-foreground hover:text-background hover:border-foreground transition-colors";

export function StageCtas({ authed }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  if (authed) {
    return (
      <div className="mt-7 flex gap-3 flex-wrap">
        <Link
          href="/games/new"
          className={PRIMARY_CTA}
          style={{ fontVariationSettings: '"opsz" 96, "SOFT" 50' }}
        >
          Begin a game
          <span className={PRIMARY_ARROW} aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mt-7 flex gap-3 flex-wrap">
        <button
          type="button"
          className={PRIMARY_CTA}
          style={{ fontVariationSettings: '"opsz" 96, "SOFT" 50' }}
          onClick={() => {
            setMode("signup");
            setOpen(true);
          }}
        >
          Sign up
          <span className={PRIMARY_ARROW} aria-hidden="true">
            →
          </span>
        </button>
        <button
          type="button"
          className={SECONDARY_CTA}
          onClick={() => {
            setMode("signin");
            setOpen(true);
          }}
        >
          Sign in
        </button>
      </div>
      {/* key={mode} remounts AuthDialog so its internal mode state resets
          correctly when the caller switches between Sign in / Sign up. */}
      <AuthDialog key={mode} open={open} onOpenChange={setOpen} initialMode={mode} />
    </>
  );
}
