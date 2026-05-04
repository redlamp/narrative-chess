"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { LoginForm } from "./(auth)/login/LoginForm";
import { SignUpForm } from "./(auth)/sign-up/SignUpForm";

// Note: server actions call redirect("/") and never return on success, so
// onSuccess fires only on error paths. Dialog-close-on-success is a Phase 8 follow-up.

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: "signin" | "signup";
};

export function AuthDialog({ open, onOpenChange, initialMode = "signin" }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);

  const onSuccess = () => {
    onOpenChange(false);
    router.push("/games");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "signin" ? "Sign in" : "Sign up"}</DialogTitle>
          <DialogDescription>
            {mode === "signin"
              ? "Welcome back. Sign in to continue."
              : "Create an account to start playing."}
          </DialogDescription>
        </DialogHeader>
        {mode === "signin" ? (
          <LoginForm onSuccess={onSuccess} />
        ) : (
          <SignUpForm onSuccess={onSuccess} />
        )}
        <p className="text-xs text-center text-muted-foreground">
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            className="underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
