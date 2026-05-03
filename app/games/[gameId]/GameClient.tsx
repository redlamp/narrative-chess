"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Chessboard } from "react-chessboard";
import type {
  Piece,
  PromotionPieceOption,
  Square,
} from "react-chessboard/dist/chessboard/types";
import { toast } from "sonner";
import { Chess } from "chess.js";
import { validateMove } from "@/lib/chess/engine";
import { makeMove } from "./actions";
import {
  subscribeToMoves,
  subscribeToGameStatus,
} from "@/lib/realtime/subscribe";
import type { GameStatus } from "@/lib/schemas/game";

type Props = {
  gameId: string;
  myColor: "w" | "b";
  whiteName: string;
  blackName: string;
  initialFen: string;
  initialPly: number;
  initialStatus: GameStatus;
};

type State = {
  fen: string;
  ply: number;
  status: GameStatus;
  pending: boolean;
};

const TERMINAL: GameStatus[] = ["white_won", "black_won", "draw", "aborted"];

function computeMyTurn(fen: string, myColor: "w" | "b"): boolean {
  try {
    return new Chess(fen).turn() === myColor;
  } catch {
    return false;
  }
}

function statusLabel(status: GameStatus): string {
  switch (status) {
    case "white_won":
      return "White wins";
    case "black_won":
      return "Black wins";
    case "draw":
      return "Draw";
    case "aborted":
      return "Game aborted";
    case "open":
      return "Waiting";
    case "in_progress":
      return "In progress";
  }
}

/** Pawn dropped onto the last rank from its 7th/2nd. */
function isPromotionDrop(
  source: Square,
  target: Square,
  piece: Piece,
): boolean {
  return (
    (piece === "wP" && source[1] === "7" && target[1] === "8") ||
    (piece === "bP" && source[1] === "2" && target[1] === "1")
  );
}

/** Map react-chessboard's PromotionPieceOption (e.g. "wQ") to UCI promo char. */
function promoCharFromOption(opt: PromotionPieceOption): "q" | "r" | "b" | "n" {
  const c = opt.charAt(1).toLowerCase();
  return (c === "q" || c === "r" || c === "b" || c === "n" ? c : "q");
}

export function GameClient({
  gameId,
  myColor,
  whiteName,
  blackName,
  initialFen,
  initialPly,
  initialStatus,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>({
    fen: initialFen,
    ply: initialPly,
    status: initialStatus,
    pending: false,
  });

  const applyMoveLocal = useCallback(
    (next: { ply: number; fen: string; status?: GameStatus }) => {
      setState((prev) => {
        if (next.ply <= prev.ply) return prev;
        return {
          ...prev,
          ply: next.ply,
          fen: next.fen,
          status: next.status ?? prev.status,
        };
      });
    },
    [],
  );

  const applyStatusLocal = useCallback((status: GameStatus) => {
    setState((prev) => ({ ...prev, status }));
  }, []);

  // Realtime: opponent's (and our own) move INSERTs.
  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null;
    let cancelled = false;
    void subscribeToMoves(gameId, (m) => {
      applyMoveLocal({ ply: m.ply, fen: m.fen_after });
    }).then((s) => {
      if (cancelled) s.unsubscribe();
      else sub = s;
    });
    return () => {
      cancelled = true;
      sub?.unsubscribe();
    };
  }, [gameId, applyMoveLocal]);

  // Realtime: status flips (open -> in_progress on join; later resign/abort).
  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null;
    let cancelled = false;
    void subscribeToGameStatus(gameId, (u) => applyStatusLocal(u.status)).then((s) => {
      if (cancelled) s.unsubscribe();
      else sub = s;
    });
    return () => {
      cancelled = true;
      sub?.unsubscribe();
    };
  }, [gameId, applyStatusLocal]);

  const myTurn =
    state.status === "in_progress" &&
    !state.pending &&
    computeMyTurn(state.fen, myColor);

  /** Send a move to the server and reconcile state. */
  const submitMove = useCallback(
    async (uci: string, expectedPly: number) => {
      setState((prev) => ({ ...prev, pending: true }));
      try {
        const result = await makeMove({ gameId, uci, expectedPly });

        if (result.ok) {
          applyMoveLocal({
            ply: result.data.ply,
            fen: result.data.fen_after,
            status: result.data.status,
          });
          if (TERMINAL.includes(result.data.status)) {
            toast.success(`Game over: ${statusLabel(result.data.status)}`);
          }
          return true;
        }

        switch (result.code) {
          case "concurrency_conflict":
            toast.warning("Position changed — refreshing");
            router.refresh();
            break;
          case "wrong_turn":
            toast.error("Not your turn");
            break;
          case "illegal_move":
            toast.error("Illegal move");
            break;
          case "game_over":
            toast.error("Game already over");
            break;
          case "not_a_participant":
            toast.error("You're not a player in this game");
            break;
          case "not_active":
            toast.error("Game is not active");
            break;
          case "game_not_found":
            toast.error("Game not found");
            break;
          case "unauthenticated":
            toast.error("Sign in again");
            router.push(`/login?next=/games/${gameId}`);
            break;
          case "validation":
            toast.error("Invalid move");
            break;
          default:
            console.error("makeMove unknown error:", result);
            toast.error("Something went wrong — try again");
        }
        return false;
      } catch (err) {
        console.error("makeMove transport error:", err);
        toast.error("Connection error — try again");
        return false;
      } finally {
        setState((prev) => ({ ...prev, pending: false }));
      }
    },
    [gameId, applyMoveLocal, router],
  );

  /**
   * Sync handler for non-promotion drops.
   * react-chessboard 4.x requires a sync `boolean` return — we cannot await the
   * server here. We pre-validate locally (cheap), kick off the server call, and
   * return `true` on local-valid drops so the board commits visually. The
   * controlled `position` prop reconciles when the server confirms (via
   * `applyMoveLocal`) or rolls back on failure (state.fen never advances, so
   * the board snaps to the previous FEN on the next render).
   */
  const onPieceDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square, piece: Piece): boolean => {
      if (!myTurn) return false;
      if (state.status !== "in_progress") return false;

      // Promotion drops are routed through the library's promotion dialog,
      // which calls `onPromotionPieceSelect`. Returning `false` here keeps the
      // piece off-board until the dialog resolves; if the user cancels the
      // dialog, the move is discarded, which is what we want.
      if (isPromotionDrop(sourceSquare, targetSquare, piece)) {
        return false;
      }

      const uci = `${sourceSquare}${targetSquare}`;

      // Local pre-validate via the existing engine wrapper — skip the server
      // round-trip on obviously-illegal drops.
      const local = validateMove(state.fen, uci);
      if (!local.ok) return false;

      // Fire-and-forget server submission; reconciliation flows back through
      // `applyMoveLocal` (success) or the unchanged `state.fen` (failure).
      void submitMove(uci, state.ply);
      return true;
    },
    [myTurn, state.status, state.fen, state.ply, submitMove],
  );

  /**
   * Called by the library after the user picks a piece in the promotion dialog.
   * Returning `false` signals the move was not accepted; `true` accepts.
   */
  const onPromotionPieceSelect = useCallback(
    (
      piece?: PromotionPieceOption,
      promoteFromSquare?: Square,
      promoteToSquare?: Square,
    ): boolean => {
      // Library invokes with no args when the user dismisses the dialog.
      if (!piece || !promoteFromSquare || !promoteToSquare) return false;
      if (!myTurn) return false;
      if (state.status !== "in_progress") return false;

      const promo = promoCharFromOption(piece);
      const uci = `${promoteFromSquare}${promoteToSquare}${promo}`;

      const local = validateMove(state.fen, uci);
      if (!local.ok) return false;

      void submitMove(uci, state.ply);
      return true;
    },
    [myTurn, state.status, state.fen, state.ply, submitMove],
  );

  const isWhitesTurn = computeMyTurn(state.fen, "w");
  const turnText =
    state.status !== "in_progress"
      ? statusLabel(state.status)
      : myTurn
        ? "Your turn"
        : "Opponent's turn";

  return (
    <main className="container mx-auto max-w-6xl py-8 px-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
      {/* Test hook — version-agnostic state probe for e2e specs.
          E2E specs assert against data-ply and data-status; the hook
          stays library-DOM-agnostic so it survives react-chessboard
          version bumps without spec churn. */}
      <div
        data-testid="game-state"
        data-ply={state.ply}
        data-status={state.status}
        aria-hidden="true"
        className="sr-only"
      />

      <div className="flex justify-center">
        <div className="w-full max-w-xl aspect-square">
          <Chessboard
            position={state.fen}
            boardOrientation={myColor === "b" ? "black" : "white"}
            onPieceDrop={onPieceDrop}
            onPromotionPieceSelect={onPromotionPieceSelect}
            arePiecesDraggable={state.status === "in_progress"}
            customBoardStyle={{ borderRadius: 6 }}
          />
        </div>
      </div>

      <aside className="space-y-6">
        <div
          className={
            "rounded border p-4 " +
            (!isWhitesTurn && state.status === "in_progress"
              ? "border-foreground"
              : "border-border")
          }
        >
          <p className="text-xs uppercase text-muted-foreground">Black</p>
          <p className="font-medium">
            {blackName}
            {myColor === "b" ? " (you)" : ""}
          </p>
        </div>

        <div className="rounded border border-dashed p-4 text-center">
          <p className="text-sm font-medium">{turnText}</p>
          <p className="text-xs text-muted-foreground mt-1">ply {state.ply}</p>
        </div>

        <div
          className={
            "rounded border p-4 " +
            (isWhitesTurn && state.status === "in_progress"
              ? "border-foreground"
              : "border-border")
          }
        >
          <p className="text-xs uppercase text-muted-foreground">White</p>
          <p className="font-medium">
            {whiteName}
            {myColor === "w" ? " (you)" : ""}
          </p>
        </div>
      </aside>
    </main>
  );
}
