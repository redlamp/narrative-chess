"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Chessboard } from "react-chessboard";
import type { Piece, PromotionPieceOption, Square } from "@/lib/chess/board-types";
import { toast } from "sonner";
import { Chess } from "chess.js";
import {
  checkState,
  isPromotionMove,
  kingSquare,
  legalMovesFrom,
  occupiedSquares,
  validateMove,
} from "@/lib/chess/engine";
import { makeMove } from "./actions";
import {
  subscribeToMoves,
  subscribeToGameStatus,
} from "@/lib/realtime/subscribe";
import type { GameStatus, TerminationReason } from "@/lib/schemas/game";
import { GameActions } from "./GameActions";
import { TerminalBanner } from "./TerminalBanner";

type Props = {
  gameId: string;
  /**
   * "w" | "b" — viewer is the white or black participant.
   * null         — viewer is an observer (read-only).
   */
  myColor: "w" | "b" | null;
  whiteName: string;
  blackName: string;
  initialFen: string;
  initialPly: number;
  initialStatus: GameStatus;
  /**
   * How the game ended (when terminal). Null while open / in progress.
   * Optional so existing call sites that haven't yet been updated still
   * type-check; defaulted to null in the destructure below.
   */
  initialTerminationReason?: TerminationReason | null;
};

type State = {
  fen: string;
  ply: number;
  status: GameStatus;
  terminationReason: TerminationReason | null;
  pending: boolean;
};

const TERMINAL: GameStatus[] = ["white_won", "black_won", "draw", "aborted"];

/** chess.js .turn() against a fen, or null on parse failure. */
function fenTurn(fen: string): "w" | "b" | null {
  try {
    return new Chess(fen).turn();
  } catch {
    return null;
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
  initialTerminationReason = null,
}: Props) {
  const router = useRouter();
  const isObserver = myColor === null;
  const [state, setState] = useState<State>({
    fen: initialFen,
    ply: initialPly,
    status: initialStatus,
    terminationReason: initialTerminationReason,
    pending: false,
  });

  // Click-to-move: square the user has tapped/clicked to start a move
  // (null when nothing is selected). Also clears whenever the position
  // advances — so an opponent's realtime move drops any stale selection.
  const [selected, setSelected] = useState<Square | null>(null);

  // Drag-source: square of the piece currently being dragged. Drives the
  // same legal-target highlight as click-selection so users see valid
  // moves while the piece is in their hand.
  const [dragSource, setDragSource] = useState<Square | null>(null);

  // Hover-target: the square the mouse / drag is currently over. Used to
  // paint a stronger border highlight on the prospective drop square,
  // layered on top of the legal-target circle.
  const [hoverSquare, setHoverSquare] = useState<Square | null>(null);

  const applyMoveLocal = useCallback(
    (next: {
      ply: number;
      fen: string;
      status?: GameStatus;
      terminationReason?: TerminationReason | null;
    }) => {
      setState((prev) => {
        // Race-safe ply guard: realtime events arrive interleaved with the
        // server-confirm path; we only advance forward. terminationReason is
        // applied alongside status under the same guard so a late realtime
        // payload doesn't overwrite a fresher server-confirm reason.
        if (next.ply <= prev.ply) return prev;
        return {
          ...prev,
          ply: next.ply,
          fen: next.fen,
          status: next.status ?? prev.status,
          terminationReason:
            next.terminationReason !== undefined
              ? next.terminationReason
              : prev.terminationReason,
        };
      });
    },
    [],
  );

  const applyStatusLocal = useCallback(
    (status: GameStatus, terminationReason?: TerminationReason | null) => {
      setState((prev) => ({
        ...prev,
        status,
        terminationReason:
          terminationReason !== undefined
            ? terminationReason
            : prev.terminationReason,
      }));
    },
    [],
  );

  // Tracks the in-flight optimistic fen + the prior fen, so a server
  // rejection can roll back the visual state — but only if no realtime
  // event has already replaced our optimistic fen with an opponent's
  // move at the next ply.
  const pendingMoveRef = useRef<{ prevFen: string; optFen: string } | null>(null);

  const rollbackOptimistic = useCallback(() => {
    const m = pendingMoveRef.current;
    pendingMoveRef.current = null;
    if (!m) return;
    setState((prev) => {
      // Realtime delivered an opponent move at ply+1 already; their fen
      // overwrites ours via the ply guard, so prev.fen no longer matches
      // our optimistic. Don't clobber the opponent's truth.
      if (prev.fen !== m.optFen) return prev;
      return { ...prev, fen: m.prevFen };
    });
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

  // Realtime: status flips (open -> in_progress on join; later resign/abort
  // and engine terminal transitions). Passes termination_reason through so
  // the banner can render the right subtitle (checkmate / resignation / ...).
  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null;
    let cancelled = false;
    void subscribeToGameStatus(gameId, (u) =>
      applyStatusLocal(u.status, u.termination_reason ?? null),
    ).then((s) => {
      if (cancelled) s.unsubscribe();
      else sub = s;
    });
    return () => {
      cancelled = true;
      sub?.unsubscribe();
    };
  }, [gameId, applyStatusLocal]);

  // Defensive cleanup on terminal transition: when status flips to
  // resign / abort / checkmate / draw, drop any pending optimistic move
  // and clear interaction residue (selection / drag / hover). The
  // make_move RPC already rejects with `not_active` if the game ended
  // mid-pending; this just makes sure the UI doesn't keep a dangling
  // "your move" affordance after status flips via realtime (e.g. the
  // opponent resigned during our drag gesture).
  //
  // Watching state.status with an effect is the simplest correct shape
  // — the realtime callbacks update setState on a different microtask
  // than the gesture handlers, so doing the cleanup synchronously inside
  // a setState updater would race with concurrent-mode batching. The
  // setState calls below run only when status was already terminal in
  // the rendered state (so prev.status is stable on re-runs); React
  // batches them into a single commit and the next effect pass sees
  // clean values + early-returns. The lint rule guards against
  // cascading render hazards which don't apply here, so it's suppressed
  // on the directly flagged setter calls.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!TERMINAL.includes(state.status)) return;
    pendingMoveRef.current = null;
    setSelected(null);
    setDragSource(null);
    setHoverSquare(null);
  }, [state.status]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Memoize the chess.js parse — fen.turn() is consulted twice per render
  // (myTurn + isWhitesTurn), and parsing the FEN is the expensive bit.
  const turn = useMemo(() => fenTurn(state.fen), [state.fen]);
  const myTurn =
    state.status === "in_progress" && !state.pending && turn === myColor;

  // Side currently in check (or null) and whether it's mate. Used by both
  // the board (king-square highlight) and the sidebar (player-card overlay
  // + status pill text).
  const check = useMemo(() => checkState(state.fen), [state.fen]);

  // Source square for the legal-target highlight: prefer the drag source
  // (active gesture), fall back to the click selection.
  const highlightSource = dragSource ?? selected;

  // Squares the highlighted piece can legally move to.
  const legalTargets = useMemo(
    () => (highlightSource ? legalMovesFrom(state.fen, highlightSource) : []),
    [highlightSource, state.fen],
  );

  // customSquareStyles composes layered overlays. Later layers spread
  // over earlier so priority is: check > selected-source > hover-border
  // > legal-target circle. The king highlight wins so a check on the
  // hovered square still reads as check.
  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // 1. Legal-target circles — small dot on empty squares, ring on
    //    capture (occupied) squares so the underlying piece stays visible.
    if (legalTargets.length > 0) {
      const occupied = occupiedSquares(state.fen);
      for (const sq of legalTargets) {
        styles[sq] = occupied.has(sq)
          ? {
              boxShadow: "inset 0 0 0 4px rgba(0, 0, 0, 0.35)",
            }
          : {
              backgroundImage:
                "radial-gradient(circle, rgba(0, 0, 0, 0.32) 22%, transparent 23%)",
            };
      }
    }

    // 2. Hover border — only when a target is in play (click-selected or
    //    being dragged) AND the hovered square is a legal target. Painted
    //    as an inset amber ring on top of the circle so the user sees a
    //    confirm-style cue before committing the move.
    if (highlightSource && hoverSquare && legalTargets.includes(hoverSquare)) {
      styles[hoverSquare] = {
        ...styles[hoverSquare],
        boxShadow: "inset 0 0 0 4px rgba(245, 158, 11, 0.85)",
      };
    }

    if (selected) {
      styles[selected] = {
        ...styles[selected],
        backgroundColor: "rgba(255, 235, 59, 0.45)", // yellow-400-ish
      };
    }

    if (check) {
      const ks = kingSquare(state.fen, check.side);
      if (ks) {
        styles[ks] = {
          ...styles[ks],
          backgroundColor: check.mate
            ? "rgba(220, 38, 38, 0.55)" // red-600 @ ~55%
            : "rgba(245, 158, 11, 0.55)", // amber-500 @ ~55%
        };
      }
    }

    return styles;
  }, [selected, legalTargets, state.fen, check, hoverSquare, highlightSource]);

  // Restrict dragging to the side-to-move's own pieces. Library calls this
  // for every piece on the board on every render; keep it cheap.
  // Observers (myColor === null) get a flat false — no piece is draggable.
  const isDraggablePiece = useCallback(
    ({ piece }: { piece: Piece }): boolean => {
      if (isObserver) return false;
      if (!myTurn) return false;
      // piece is "wP" | "bP" | "wN" | etc — first char is color.
      return piece.charAt(0) === myColor;
    },
    [isObserver, myTurn, myColor],
  );

  /** Send a move to the server and reconcile state. */
  const submitMove = useCallback(
    async (uci: string, expectedPly: number) => {
      try {
        const result = await makeMove({ gameId, uci, expectedPly });

        if (result.ok) {
          // Server confirmed; clear the rollback target — the server's
          // ply will land via applyMoveLocal and supersede our optimistic fen.
          pendingMoveRef.current = null;
          applyMoveLocal({
            ply: result.data.ply,
            fen: result.data.fen_after,
            status: result.data.status,
            terminationReason: result.data.termination_reason ?? null,
          });
          if (TERMINAL.includes(result.data.status)) {
            toast.success(`Game over: ${statusLabel(result.data.status)}`);
          }
          return true;
        }

        // Server rejected — undo the optimistic fen if it's still in place.
        rollbackOptimistic();

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
        rollbackOptimistic();
        console.error("makeMove transport error:", err);
        toast.error("Connection error — try again");
        return false;
      } finally {
        setState((prev) => ({ ...prev, pending: false }));
      }
    },
    [gameId, applyMoveLocal, rollbackOptimistic, router],
  );

  /**
   * Commit an optimistic fen update + kick off the server call.
   *
   * react-chessboard 4.x requires a sync `boolean` return from drop /
   * promotion handlers — we can't await the server. To avoid a snap-back
   * flicker on the controlled `position` prop, we update local fen
   * synchronously to chess.js's computed post-move fen, then fire the
   * Server Action async. On server success, applyMoveLocal advances ply
   * (idempotent for the fen); on failure, rollbackOptimistic reverts
   * the fen if no opponent move has replaced it via realtime in the
   * meantime.
   *
   * ply stays at the canonical (server-confirmed) value during the
   * optimistic window, so a concurrent opponent move at ply+1 still
   * passes the applyMoveLocal ply guard and overwrites our optimistic
   * fen — which is the right thing.
   */
  const commitOptimisticAndSubmit = useCallback(
    (uci: string, optFen: string) => {
      pendingMoveRef.current = { prevFen: state.fen, optFen };
      setState((prev) => ({ ...prev, fen: optFen, pending: true }));
      void submitMove(uci, state.ply);
    },
    [state.fen, state.ply, submitMove],
  );

  /**
   * Drag-begin handler — record the source square so customSquareStyles
   * can light up the same legal-target highlight that click-selection
   * provides. Drag overrides any prior click selection so we don't render
   * two highlight sources at once.
   */
  const onPieceDragBegin = useCallback(
    (_piece: Piece, sourceSquare: Square) => {
      if (isObserver) return;
      setDragSource(sourceSquare);
      setSelected(null);
    },
    [isObserver],
  );

  /**
   * Drag-end handler — clear the drag source regardless of whether the
   * drop succeeded. Move state advancement / rollback happens through
   * onPieceDrop -> commitOptimisticAndSubmit.
   */
  const onPieceDragEnd = useCallback(() => {
    setDragSource(null);
    setHoverSquare(null);
  }, []);

  /**
   * Hover handlers — track which square the mouse / drag is over so the
   * customSquareStyles memo can paint a confirm-border on the prospective
   * drop square. Fires on every square crossing; the renderer trivially
   * memoizes on hoverSquare so this is fine for a 64-square board.
   */
  const onSquareMouseOver = useCallback((square: Square) => {
    setHoverSquare(square);
  }, []);

  const onSquareMouseOut = useCallback((square: Square) => {
    setHoverSquare((prev) => (prev === square ? null : prev));
  }, []);

  /**
   * Sync handler for non-promotion drops.
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

      // Local pre-validate — skip the server round-trip on illegal drops
      // and capture the post-move fen for the optimistic update.
      const local = validateMove(state.fen, uci);
      if (!local.ok) return false;

      commitOptimisticAndSubmit(uci, local.fenAfter);
      return true;
    },
    [myTurn, state.status, state.fen, commitOptimisticAndSubmit],
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

      commitOptimisticAndSubmit(uci, local.fenAfter);
      return true;
    },
    [myTurn, state.status, state.fen, commitOptimisticAndSubmit],
  );

  /**
   * Click-to-move handler. Two-step interaction:
   *   1. First click on an own piece (myTurn) selects it; legal targets
   *      light up via customSquareStyles.
   *   2. Second click on a legal target submits the move. Click on the
   *      same selected square deselects. Click on another own piece
   *      reselects. Click anywhere else deselects.
   *
   * Promotion via click defaults to queen — most users want queen, and
   * non-queen promotions are still available via drag (which routes
   * through the library's promotion dialog).
   */
  const onSquareClick = useCallback(
    (square: Square, piece?: Piece): void => {
      if (isObserver) return;
      if (state.status !== "in_progress") return;

      // With a selection in hand:
      if (selected) {
        // Deselect on click of the same square.
        if (square === selected) {
          setSelected(null);
          return;
        }
        // Submit on legal target.
        if (legalTargets.includes(square)) {
          const promo = isPromotionMove(state.fen, selected, square) ? "q" : "";
          const uci = `${selected}${square}${promo}`;
          const local = validateMove(state.fen, uci);
          setSelected(null);
          if (local.ok) commitOptimisticAndSubmit(uci, local.fenAfter);
          return;
        }
        // Reselect another own piece.
        if (piece && piece.charAt(0) === myColor && myTurn) {
          setSelected(square);
          return;
        }
        // Otherwise deselect.
        setSelected(null);
        return;
      }

      // No selection: first click on an own piece on own turn selects it.
      if (myTurn && piece && piece.charAt(0) === myColor) {
        setSelected(square);
      }
    },
    [
      isObserver,
      state.status,
      state.fen,
      selected,
      legalTargets,
      myColor,
      myTurn,
      commitOptimisticAndSubmit,
    ],
  );

  const isWhitesTurn = turn === "w";
  const inProgress = state.status === "in_progress";
  const blackActive = inProgress && !isWhitesTurn;
  const whiteActive = inProgress && isWhitesTurn;

  // Status-pill text — promotes check / checkmate over the generic
  // "your turn" / "opponent's turn" copy so the player notices. Observers
  // get a flat "Observing" + the side-to-move so they can follow along.
  const turnText = (() => {
    if (!inProgress) return statusLabel(state.status);
    if (isObserver) {
      if (check?.mate) {
        return `Checkmate — ${check.side === "w" ? "black" : "white"} wins`;
      }
      if (check) {
        return `Check on ${check.side === "w" ? "white" : "black"}`;
      }
      return `Observing — ${isWhitesTurn ? "white" : "black"} to move`;
    }
    if (check?.mate) return check.side === myColor ? "Checkmate — you lose" : "Checkmate";
    if (check) return check.side === myColor ? "Check — your move" : "Check";
    return myTurn ? "Your turn" : "Opponent's turn";
  })();

  // Per-pill overlay color when the corresponding king is in check / mate.
  // Same palette as the king-square highlight, ~60% alpha so the team's
  // light/dark base color is still legible underneath.
  const checkOverlay = (side: "w" | "b"): string | null => {
    if (!check || check.side !== side) return null;
    return check.mate ? "rgba(220, 38, 38, 0.6)" : "rgba(245, 158, 11, 0.6)";
  };
  const blackOverlay = checkOverlay("b");
  const whiteOverlay = checkOverlay("w");

  return (
    <main className="container mx-auto max-w-6xl py-8 px-6 space-y-4">
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

      {/* Terminal banner — renders only on terminal status (returns null
          otherwise). Mounted above the board so the result is the first
          thing the eye lands on after a game ends. Width matches the
          sidebar/board column for visual alignment. */}
      <TerminalBanner
        status={state.status}
        terminationReason={state.terminationReason}
        isObserver={isObserver}
      />

      <div className="flex justify-center">
        <div className="w-full max-w-xl aspect-square">
          <Chessboard
            position={state.fen}
            boardOrientation={myColor === "b" ? "black" : "white"}
            onPieceDrop={onPieceDrop}
            onPieceDragBegin={onPieceDragBegin}
            onPieceDragEnd={onPieceDragEnd}
            onPromotionPieceSelect={onPromotionPieceSelect}
            onSquareClick={onSquareClick}
            onMouseOverSquare={onSquareMouseOver}
            onMouseOutSquare={onSquareMouseOut}
            arePiecesDraggable={inProgress && !isObserver}
            isDraggablePiece={isDraggablePiece}
            customSquareStyles={customSquareStyles}
            customBoardStyle={{ borderRadius: 6 }}
          />
        </div>
      </div>

      {/* Sidebar — single horizontal row of three pills. Player pills
          render in their team's colors (black bg / white bg); the turn
          pill in the middle adopts the active side's palette and shows
          an arrow pointing to whichever player is to move. */}
      <aside className="flex items-stretch gap-2 max-w-xl mx-auto w-full text-sm">
        <div
          className={cn(
            "relative flex-1 rounded border px-3 py-2 bg-zinc-900 text-zinc-100 border-zinc-700 transition-shadow overflow-hidden",
            blackActive && "ring-2 ring-amber-400",
          )}
        >
          {blackOverlay && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ backgroundColor: blackOverlay }}
            />
          )}
          <div className="relative">
            <p className="text-[10px] uppercase tracking-wide opacity-60">
              Black{myColor === "b" ? " (you)" : ""}
            </p>
            <p className="font-medium truncate">{blackName}</p>
          </div>
        </div>

        <div
          className={cn(
            "flex flex-col items-center justify-center rounded border px-3 py-2 min-w-[112px] transition-colors",
            !inProgress && "bg-muted text-muted-foreground border-border",
            whiteActive && "bg-white text-zinc-900 border-zinc-300",
            blackActive && "bg-zinc-900 text-zinc-100 border-zinc-700",
          )}
        >
          <span className="font-medium text-xs">{turnText}</span>
          {inProgress && (
            <span
              className="text-base leading-none mt-0.5"
              aria-hidden="true"
              title={whiteActive ? "white to move" : "black to move"}
            >
              {whiteActive ? "▶" : "◀"}
            </span>
          )}
          <span className="text-[10px] opacity-60 mt-0.5">ply {state.ply}</span>
        </div>

        <div
          className={cn(
            "relative flex-1 rounded border px-3 py-2 bg-white text-zinc-900 border-zinc-300 transition-shadow overflow-hidden",
            whiteActive && "ring-2 ring-amber-400",
          )}
        >
          {whiteOverlay && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ backgroundColor: whiteOverlay }}
            />
          )}
          <div className="relative">
            <p className="text-[10px] uppercase tracking-wide opacity-60">
              White{myColor === "w" ? " (you)" : ""}
            </p>
            <p className="font-medium truncate">{whiteName}</p>
          </div>
        </div>
      </aside>

      {/* Game actions — resign + abort buttons. Self-hides for observers
          and for non-active games, so this is safe to mount unconditionally.
          Sits beneath the sidebar so the player-card row stays a clean
          three-pill identity strip. */}
      <div className="max-w-xl mx-auto w-full">
        <GameActions
          gameId={gameId}
          status={state.status}
          ply={state.ply}
          isObserver={isObserver}
        />
      </div>
    </main>
  );
}
