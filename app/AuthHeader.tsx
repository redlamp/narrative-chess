"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "./AuthDialog";

type Props = { authed: boolean };

const PRIMARY_CTA =
  "h-14 px-10 text-base font-heading font-semibold tracking-wide shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all";
const SECONDARY_CTA =
  "h-14 px-8 text-base font-heading hover:-translate-y-0.5 transition-all";

export function AuthHeader({ authed }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  if (authed) {
    return (
      <div className="flex justify-center py-8">
        <Button asChild className={PRIMARY_CTA}>
          <Link href="/games">Continue to games</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap justify-center gap-3 py-8">
        <Button
          variant="outline"
          className={SECONDARY_CTA}
          onClick={() => {
            setMode("signin");
            setOpen(true);
          }}
        >
          Sign in
        </Button>
        <Button
          className={PRIMARY_CTA}
          onClick={() => {
            setMode("signup");
            setOpen(true);
          }}
        >
          Sign up
        </Button>
      </div>
      {/* key={mode} remounts AuthDialog so useState(initialMode) resets correctly
          when switching between Sign in and Sign up. */}
      <AuthDialog key={mode} open={open} onOpenChange={setOpen} initialMode={mode} />
    </>
  );
}
