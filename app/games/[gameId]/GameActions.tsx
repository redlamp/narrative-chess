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
import {
  resign,
  abortGame,
  offerDraw,
  withdrawDraw,
  acceptDraw,
  declineDraw,
} from "./actions";
import type { GameStatus } from "@/lib/schemas/game";

type Props = {
  gameId: string;
  status: GameStatus;
  ply: number;
  isObserver: boolean;
  /** Polish A — uuid of the player with an outstanding draw offer, or null. */
  drawOfferedBy: string | null;
  viewerUserId: string;
};

type Pending = "resign" | "abort" | "offer" | null;

export function GameActions({
  gameId,
  status,
  ply,
  isObserver,
  drawOfferedBy,
  viewerUserId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<Pending>(null);

  if (isObserver) return null;
  if (status !== "in_progress") return null;

  const showAbort = ply === 0;
  const showResign = ply >= 1;
  const showDrawOffer = ply >= 1 && drawOfferedBy === null;
  const myOfferOutstanding = drawOfferedBy === viewerUserId;
  const opponentOfferOutstanding =
    drawOfferedBy !== null && drawOfferedBy !== viewerUserId;

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

  const onOfferDraw = () => {
    startTransition(async () => {
      const result = await offerDraw({ gameId });
      setConfirming(null);
      if (result.ok) {
        toast("Draw offered.");
        return;
      }
      switch (result.code) {
        case "offer_already_outstanding":
          toast.warning("A draw offer is already outstanding");
          break;
        case "pre_game":
          toast.warning("Make a move before offering a draw");
          break;
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
        default:
          toast.error("Something went wrong — try again");
      }
    });
  };

  const onWithdrawDraw = () => {
    startTransition(async () => {
      const result = await withdrawDraw({ gameId });
      if (result.ok) {
        toast("Offer withdrawn.");
        return;
      }
      switch (result.code) {
        case "no_offer":
          // Race: opponent already accepted/declined or made a move that
          // implicitly cleared the offer. Refresh to sync visible state.
          router.refresh();
          break;
        case "not_offerer":
          toast.error("Only the offerer can withdraw");
          break;
        default:
          toast.error("Something went wrong — try again");
      }
    });
  };

  const onAcceptDraw = () => {
    startTransition(async () => {
      const result = await acceptDraw({ gameId });
      if (result.ok) {
        toast.success("Draw accepted.");
        return;
      }
      switch (result.code) {
        case "no_offer":
          router.refresh();
          break;
        case "not_active":
          toast.warning("Game is no longer active");
          router.refresh();
          break;
        case "cannot_accept_own_offer":
          toast.error("You can't accept your own offer");
          break;
        default:
          toast.error("Something went wrong — try again");
      }
    });
  };

  const onDeclineDraw = () => {
    startTransition(async () => {
      const result = await declineDraw({ gameId });
      if (result.ok) {
        toast("Draw declined.");
        return;
      }
      switch (result.code) {
        case "no_offer":
          router.refresh();
          break;
        case "cannot_decline_own_offer":
          toast.error("You can't decline your own offer");
          break;
        default:
          toast.error("Something went wrong — try again");
      }
    });
  };

  return (
    <>
      {/* Draw-offer banner — shown when an offer is in flight, regardless
          of which side made it. Lives above the action button row so it's
          the most visible affordance for the receiver. */}
      {opponentOfferOutstanding && (
        <div className="rounded border border-rule-soft bg-bg-soft/60 px-3 py-2 text-sm">
          <p className="font-mono text-[11px] tracking-wide uppercase text-ink-faint mb-1.5">
            Opponent offers a draw
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={onAcceptDraw}
            >
              Accept
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={onDeclineDraw}
            >
              Decline
            </Button>
          </div>
        </div>
      )}

      {myOfferOutstanding && (
        <div className="rounded border border-rule-soft bg-bg-soft/40 px-3 py-2 text-sm">
          <p className="font-mono text-[11px] tracking-wide uppercase text-ink-faint mb-1.5">
            Draw offered — waiting for opponent
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={onWithdrawDraw}
          >
            Withdraw offer
          </Button>
        </div>
      )}

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
        {showDrawOffer && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setConfirming("offer")}
          >
            Offer Draw
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
              {confirming === "resign"
                ? "Resign game?"
                : confirming === "abort"
                  ? "Abort game?"
                  : "Offer draw?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming === "resign"
                ? "Your opponent will win. This cannot be undone."
                : confirming === "abort"
                  ? "The game ends with no result. This cannot be undone."
                  : "Your opponent will be notified. They can accept, decline, or ignore — making any move automatically declines."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={
                confirming === "resign"
                  ? onResign
                  : confirming === "abort"
                    ? onAbort
                    : onOfferDraw
              }
            >
              {pending
                ? "…"
                : confirming === "resign"
                  ? "Resign"
                  : confirming === "abort"
                    ? "Abort"
                    : "Offer Draw"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
