"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "./AuthDialog";

type Props = { authed: boolean };

export function AuthHeader({ authed }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  if (authed) {
    return (
      <header className="absolute top-16 right-4 z-10">
        <Button asChild>
          <Link href="/games">Continue</Link>
        </Button>
      </header>
    );
  }

  return (
    <>
      <header className="absolute top-16 right-4 z-10 flex items-center gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            setMode("signin");
            setOpen(true);
          }}
        >
          Sign in
        </Button>
        <Button
          onClick={() => {
            setMode("signup");
            setOpen(true);
          }}
        >
          Sign up
        </Button>
      </header>
      <AuthDialog open={open} onOpenChange={setOpen} initialMode={mode} />
    </>
  );
}
