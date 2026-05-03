"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { joinGame } from "./actions";

type Props = {
  gameId: string;
  emptySide: "white" | "black";
};

export function JoinGameForm({ gameId, emptySide }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const result = await joinGame({ gameId });
      if (result.ok) {
        router.refresh();
        return;
      }
      switch (result.code) {
        case "already_filled":
          toast.warning("Someone else joined first");
          router.refresh();
          break;
        case "already_a_participant":
          toast.info("You're already in this game");
          router.refresh();
          break;
        case "not_open":
          toast.warning("Game is no longer open");
          router.refresh();
          break;
        case "game_not_found":
          toast.error("Game not found");
          break;
        case "unauthenticated":
          toast.error("Sign in again");
          router.push(`/login?next=/games/${gameId}`);
          break;
        default:
          toast.error("Something went wrong — try again");
      }
    });
  };

  return (
    <main className="container mx-auto max-w-xl py-16 px-6 space-y-6 text-center">
      <h1 className="text-2xl font-heading font-semibold">Join this game?</h1>
      <p className="text-sm text-muted-foreground">
        The {emptySide === "white" ? "white" : "black"} side is open.
      </p>
      <Button size="lg" onClick={onClick} disabled={pending}>
        {pending ? "Joining…" : `Join as ${emptySide}`}
      </Button>
    </main>
  );
}
