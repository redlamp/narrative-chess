"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { resign, abortGame } from "./actions";
import type { GameStatus } from "@/lib/schemas/game";

type Props = {
  gameId: string;
  status: GameStatus;
  ply: number;
  isObserver: boolean;
};

type Pending = "resign" | "abort" | null;

export function GameActions({ gameId, status, ply, isObserver }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<Pending>(null);

  if (isObserver) return null;
  if (status !== "in_progress") return null;

  const showAbort = ply === 0;
  const showResign = ply >= 1;

  const onResign = () => {
    startTransition(async () => {
      const result = await resign({ gameId });
      setConfirming(null);
      if (result.ok) return;
      switch (result.code) {
        case "not_active":
          toast.warning("Game is no longer active");
          router.refresh();
          break;
        case "not_a_participant":
          toast.error("You're not a player in this game");
          break;
        case "game_not_found":
          toast.error("Game not found");
          break;
        case "unauthenticated":
          toast.error("Sign in again");
          router.push(`/login?next=/games/${gameId}`);
          break;
        case "validation":
          toast.error("Invalid request");
          break;
        default:
          toast.error("Something went wrong — try again");
      }
    });
  };

  const onAbort = () => {
    startTransition(async () => {
      const result = await abortGame({ gameId });
      setConfirming(null);
      if (result.ok) return;
      switch (result.code) {
        case "not_abortable":
          toast.warning("Game has already started");
          router.refresh();
          break;
        case "not_a_participant":
          toast.error("You're not a player in this game");
          break;
        case "game_not_found":
          toast.error("Game not found");
          break;
        case "unauthenticated":
          toast.error("Sign in again");
          router.push(`/login?next=/games/${gameId}`);
          break;
        case "validation":
          toast.error("Invalid request");
          break;
        default:
          toast.error("Something went wrong — try again");
      }
    });
  };

  return (
    <>
      <div className="flex items-center justify-center gap-2 text-sm">
        {showAbort && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setConfirming("abort")}
          >
            Abort
          </Button>
        )}
        {showResign && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setConfirming("resign")}
          >
            Resign
          </Button>
        )}
      </div>

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming === "resign" ? "Resign game?" : "Abort game?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming === "resign"
                ? "Your opponent will win. This cannot be undone."
                : "The game ends with no result. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={confirming === "resign" ? onResign : onAbort}
            >
              {pending ? "…" : confirming === "resign" ? "Resign" : "Abort"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
