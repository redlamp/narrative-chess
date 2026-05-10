"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Chessboard } from "react-chessboard";
import gsap from "gsap";
import type { Piece, PromotionPieceOption, Square } from "@/lib/chess/board-types";
import { taylorPieces } from "@/lib/chess/piece-set";
import { capturedFromFen } from "@/lib/chess/captures";
import { CapturedStrip } from "./CapturedStrip";
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
import type { GameStatus, MoveEvent, TerminationReason } from "@/lib/schemas/game";
import { GameActions } from "./GameActions";
import { TerminalBanner } from "./TerminalBanner";
import { InGameBanner } from "./InGameBanner";
import { ObserverCount } from "./ObserverCount";
import { Clock } from "./Clock";
import { useAutoClaim } from "./useAutoClaim";
import { computeRemaining, type ClockMode } from "@/lib/chess/clock";
import { viewedFen, type MoveLike } from "@/lib/chess/move-list";
import { MoveList } from "./MoveList";
import dynamic from "next/dynamic";

// Dev-only smoke button — dynamic import gated on VERCEL_ENV. We can't
// gate on NODE_ENV because Vercel sets it to "production" for both
// production AND preview builds, which would hide dev tools on previews
// (exactly where we want them visible for smoke testing). VERCEL_ENV is
// surfaced to the client via next.config.ts -> env.NEXT_PUBLIC_VERCEL_ENV
// (defaults to "development" off-platform). Next inlines NEXT_PUBLIC_* at
// build time, so this gate is statically replaceable and the smoke chunk
// dead-code-eliminates in production builds.
const SmokeFoolsMate =
  process.env.NEXT_PUBLIC_VERCEL_ENV !== "production"
    ? dynamic(() =>
        import("./SmokeFoolsMate").then((m) => ({
          default: m.SmokeFoolsMate,
        })),
      )
    : null;

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
   */
  initialTerminationReason: TerminationReason | null;
  initialObserverCount: number;
  viewerUserId: string;
  /** M1.5++ time-control fields. NULL type = untimed game (no clocks render). */
  timeControlType: "live" | "correspondence" | null;
  initialWhiteRemainingMs: number | null;
  initialBlackRemainingMs: number | null;
  initialTurnStartedAt: string | null;
  initialMoves: MoveEvent[];
};

type State = {
  fen: string;
  ply: number;
  status: GameStatus;
  terminationReason: TerminationReason | null;
  pending: boolean;
  whiteRemainingMs: number | null;
  blackRemainingMs: number | null;
  turnStartedAt: string | null;
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
  initialTerminationReason,
  initialObserverCount,
  viewerUserId,
  timeControlType,
  initialWhiteRemainingMs,
  initialBlackRemainingMs,
  initialTurnStartedAt,
  initialMoves,
}: Props) {
  const router = useRouter();
  const isObserver = myColor === null;
  const [state, setState] = useState<State>({
    fen: initialFen,
    ply: initialPly,
    status: initialStatus,
    terminationReason: initialTerminationReason,
    pending: false,
    whiteRemainingMs: initialWhiteRemainingMs,
    blackRemainingMs: initialBlackRemainingMs,
    turnStartedAt: initialTurnStartedAt,
  });

  const [moves, setMoves] = useState<MoveLike[]>(
    initialMoves.map((m) => ({ ply: m.ply, san: m.san, fen_after: m.fen_after })),
  );
  const [viewedPly, setViewedPly] = useState<number | null>(null);

  const livePly = state.ply;

  // Scrub playback state. When the user clicks a non-adjacent ply in the
  // move list, we run a GSAP timeline that walks the board through every
  // intermediate FEN at a per-move tween speed. While playback is active
  // `scrubPlaybackFen` overrides the natural displayFen so the board
  // renders the timeline's intermediate position rather than snapping to
  // the target. `scrubAnimDuration` is fed to react-chessboard's
  // animationDuration prop so each intermediate position eases over the
  // same per-move budget. `currentScrubPlyRef` tracks the ply currently
  // shown so a re-click mid-playback resumes from where the eye left off.
  // `isPlaying` is the higher-level intent flag set when the user clicks
  // the Play button — drives the move-list Play button's active styling
  // independently of whether a curve-scrub is running.
  const [scrubPlaybackFen, setScrubPlaybackFen] = useState<string | null>(null);
  const [scrubAnimDuration, setScrubAnimDuration] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const scrubTlRef = useRef<gsap.core.Timeline | null>(null);
  const currentScrubPlyRef = useRef<number | null>(null);

  // Kill in-flight playback on unmount so a navigation away doesn't leave
  // a dangling timeline firing setState on a stale React tree.
  useEffect(() => {
    return () => {
      scrubTlRef.current?.kill();
      scrubTlRef.current = null;
    };
  }, []);

  const displayFen = useMemo(
    () => scrubPlaybackFen ?? viewedFen(moves, viewedPly, state.fen),
    [scrubPlaybackFen, moves, viewedPly, state.fen],
  );

  /**
   * Scrub handler — wraps setViewedPly with a GSAP timeline that animates
   * the chessboard through every intermediate FEN between the current
   * shown ply and `target`.
   *
   * Per-move tween budget (per the design): perMove = clamp(20, 200, 2000/N)
   * where N is the number of intervening plies. Single-ply scrub plays at
   * 200ms (snappy). 10-move scrub fills the 2s budget at 200ms each.
   * Long scrubs floor at 20ms per move; total may exceed 2s past N=100.
   *
   * react-chessboard's animationDuration prop drives its internal piece
   * tween. We set it equal to perMove so each intermediate position eases
   * over the same window the timeline allots before firing the next
   * position. (Per chessboard docs: setting position before animation
   * completes cancels the in-flight tween — equal timing avoids that.)
   *
   * Re-click mid-playback: kill the existing timeline, take whatever ply
   * was last painted (currentScrubPlyRef) as the new start, build a fresh
   * timeline. Snap-to-live (livePly bump) goes through the auto-snap
   * effect which clears playback wholesale.
   */
  const handleScrub = useCallback(
    (
      target: number | null,
      opts?: { paceMs?: number; isPlay?: boolean },
    ) => {
      const paceMs = opts?.paceMs;
      // Any non-Play scrub clears isPlaying; the Play button passes
      // isPlay:true to keep the active styling lit through its tl.
      setIsPlaying(opts?.isPlay ?? false);
      if (scrubTlRef.current) {
        scrubTlRef.current.kill();
        scrubTlRef.current = null;
      }

      const targetPly = target ?? livePly;
      const startPly =
        currentScrubPlyRef.current ?? (viewedPly ?? livePly);
      currentScrubPlyRef.current = null;

      if (startPly === targetPly) {
        // Click landed on the same ply we're already showing — sync the
        // viewedPly state (handles the live<->scrubbed null/livePly
        // mapping) and bail without playback.
        setViewedPly(target);
        setScrubPlaybackFen(null);
        setScrubAnimDuration(null);
        return;
      }

      const direction = targetPly > startPly ? 1 : -1;
      const steps = Math.abs(targetPly - startPly);
      // Fixed pace overrides the curve - used by the Play button which
      // wants a consistent 1s/move regardless of game length. Step
      // buttons + cell clicks omit paceMs and use the curve so 22-move
      // jumps still fit the 2s budget.
      const perMoveMs =
        paceMs ?? Math.max(20, Math.min(200, Math.round(2000 / steps)));
      // Tween duration is independent of pace. When paceMs is supplied
      // (Play button, 1000ms cadence) we want each piece slide to look
      // like a normal live move (200ms) and the rest of the interval to
      // be a quiet wait. When paceMs is omitted (curve scrub) tween =
      // pace so each segment fills its slot rather than ending early
      // and then snapping mid-pause.
      const tweenMs = paceMs !== undefined ? 200 : perMoveMs;

      // Freeze the board at the start FEN, set the chessboard
      // animationDuration prop to tweenMs (drives each intermediate
      // position's piece slide), then schedule each intermediate FEN
      // perMoveMs apart.
      setScrubPlaybackFen(viewedFen(moves, startPly, state.fen));
      setScrubAnimDuration(tweenMs);

      const tl = gsap.timeline({
        onComplete: () => {
          setScrubPlaybackFen(null);
          setScrubAnimDuration(null);
          setIsPlaying(false);
          currentScrubPlyRef.current = null;
          scrubTlRef.current = null;
        },
      });

      for (let i = 1; i <= steps; i++) {
        const stepPly = startPly + direction * i;
        // Map the final step to viewedPly=null when target was null, so
        // we land in the canonical "live" state rather than viewedPly =
        // livePly (functionally equivalent for the FEN, but auto-snap
        // and arePiecesDraggable both prefer the explicit null).
        const stepViewedPly =
          i === steps && target === null ? null : stepPly;
        tl.call(
          () => {
            // viewedPly walks alongside scrubPlaybackFen so MoveList's
            // active highlight (activePly = viewedPly ?? livePly) tracks
            // the cell whose ply matches the currently-painted board.
            setViewedPly(stepViewedPly);
            setScrubPlaybackFen(viewedFen(moves, stepPly, state.fen));
            currentScrubPlyRef.current = stepPly;
          },
          undefined,
          (i * perMoveMs) / 1000,
        );
      }

      scrubTlRef.current = tl;
    },
    [moves, viewedPly, livePly, state.fen],
  );

  // Auto-snap to live: when livePly bumps (own optimistic apply or
  // realtime opponent INSERT), reset viewedPly to null so the viewer
  // jumps back to the live position. Without this, a player who's
  // scrubbed back stays scrubbed when their opponent moves — easy to
  // miss the new position. The ref tracks the last seen livePly so we
  // only fire when it actually changes (not on unrelated re-renders).
  const prevLivePlyRef = useRef(livePly);
  useEffect(() => {
    if (livePly !== prevLivePlyRef.current) {
      // A new live position landed (own confirm or opponent realtime).
      // If the user was mid-scrub-playback when this fired, kill the
      // timeline outright — the auto-snap takes priority over watching
      // the rest of an old sequence play out.
      if (scrubTlRef.current) {
        scrubTlRef.current.kill();
        scrubTlRef.current = null;
      }
      setViewedPly(null);
      setScrubPlaybackFen(null);
      setScrubAnimDuration(null);
      setIsPlaying(false);
      currentScrubPlyRef.current = null;
      prevLivePlyRef.current = livePly;
    }
  }, [livePly]);

  // Audio cue — wooden thunk on every livePly bump (own + opponent moves).
  // Asset: public/sounds/move.mp3 (lichess CC-BY 4.0).
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const a = new Audio("/sounds/move.mp3");
    a.volume = 0.5;
    a.preload = "auto";
    audioRef.current = a;
  }, []);

  // Cue + Your-turn toast on livePly bump.
  // Audio plays for every move (own + opponent). Toast only fires when the
  // new live position is the viewer's turn — so you hear the thunk on your
  // own move but the toast only appears when the opponent has played and
  // the clock is now on you.
  const prevLivePlyForCueRef = useRef(livePly);
  useEffect(() => {
    if (livePly === 0) return;
    if (livePly === prevLivePlyForCueRef.current) return;
    prevLivePlyForCueRef.current = livePly;

    const a = audioRef.current;
    if (a) {
      a.currentTime = 0;
      // Browser autoplay policy: first call before user interaction may
      // reject. Subsequent calls unlock once user has interacted with the
      // page anywhere (clicking sign-in, the board, etc).
      a.play().catch(() => { /* swallow autoplay rejection */ });
    }

    // Derive side-to-move from fen — `state.currentTurn` doesn't exist
    // on the State shape; the canonical turn is fenTurn(state.fen).
    const currentTurn = fenTurn(state.fen);
    if (
      !isObserver &&
      state.status === "in_progress" &&
      currentTurn === myColor
    ) {
      toast("Your turn.", { duration: 3500 });
    }
  }, [livePly, isObserver, state.status, state.fen, myColor]);

  const mode: ClockMode = timeControlType ?? "untimed";

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
    (
      status: GameStatus,
      terminationReason?: TerminationReason | null,
      clock?: {
        whiteRemainingMs?: number | null;
        blackRemainingMs?: number | null;
        turnStartedAt?: string | null;
      },
    ) => {
      setState((prev) => ({
        ...prev,
        status,
        terminationReason:
          terminationReason !== undefined
            ? terminationReason
            : prev.terminationReason,
        whiteRemainingMs:
          clock?.whiteRemainingMs !== undefined
            ? clock.whiteRemainingMs
            : prev.whiteRemainingMs,
        blackRemainingMs:
          clock?.blackRemainingMs !== undefined
            ? clock.blackRemainingMs
            : prev.blackRemainingMs,
        turnStartedAt:
          clock?.turnStartedAt !== undefined
            ? clock.turnStartedAt
            : prev.turnStartedAt,
      }));
    },
    [],
  );

  // Tracks the in-flight optimistic fen + the prior fen, so a server
  // rejection can roll back the visual state — but only if no realtime
  // event has already replaced our optimistic fen with an opponent's
  // move at the next ply. `optimisticPly` lets rollback also pull the
  // phantom move-list entry we appended at piece-place time.
  const pendingMoveRef = useRef<{
    prevFen: string;
    optFen: string;
    optimisticPly: number;
  } | null>(null);

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
    // Pull the phantom move-list entry. If the server-confirm path or
    // realtime echo already inserted the canonical version (same ply),
    // this filter is a no-op for that entry — but our optimistic one
    // had the same ply, so dedup means at most one entry exists either
    // way.
    setMoves((prev) => prev.filter((x) => x.ply !== m.optimisticPly));
  }, []);

  // Realtime: opponent's (and our own) move INSERTs.
  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null;
    let cancelled = false;
    void subscribeToMoves(gameId, (m) => {
      applyMoveLocal({ ply: m.ply, fen: m.fen_after });
      setMoves((prev) => {
        if (prev.some((x) => x.ply === m.ply)) return prev;
        return [
          ...prev,
          { ply: m.ply, san: m.san, fen_after: m.fen_after },
        ].sort((a, b) => a.ply - b.ply);
      });
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
      applyStatusLocal(u.status, u.termination_reason ?? null, {
        whiteRemainingMs: u.white_remaining_ms ?? null,
        blackRemainingMs: u.black_remaining_ms ?? null,
        turnStartedAt: u.turn_started_at ?? null,
      }),
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

  // Captured pieces derived from the live FEN. byWhite holds the BLACK
  // pieces that white has taken (rendered on white's pill) and vice versa.
  // Recomputed on every fen change; uses the displayed fen so reviewing
  // history shows captures up to the viewed ply.
  const { byWhite: capturedByWhite, byBlack: capturedByBlack } = useMemo(
    () => capturedFromFen(displayFen),
    [displayFen],
  );

  // Local clock-tick state — used by the own-clock guard below. Stays null
  // on SSR + first client render so hydration matches; mount effect seeds it
  // to Date.now() post-hydrate, and the interval keeps it fresh while the
  // game is active.
  const [tickNow, setTickNow] = useState<number | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode === "untimed") return;
    setTickNow(Date.now());
    if (state.status !== "in_progress") return;
    const id = window.setInterval(() => setTickNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [mode, state.status]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Own-clock guard: when timed and our interpolated remaining hits 0, lock
  // the move UI client-side. Server enforces this anyway, but a stale frame
  // shouldn't even let us try.
  const myClockExpired = useMemo(() => {
    if (mode === "untimed") return false;
    if (myColor === null) return false;
    if (tickNow === null) return false; // pre-hydration: don't lock UI yet
    const myRemainingMs =
      myColor === "w" ? state.whiteRemainingMs : state.blackRemainingMs;
    if (myRemainingMs === null) return false;
    const myIsActive = state.status === "in_progress" && turn === myColor;
    const turnStartedAtMs = state.turnStartedAt
      ? new Date(state.turnStartedAt).getTime()
      : null;
    const displayed = computeRemaining({
      remainingMs: myRemainingMs,
      turnStartedAtMs,
      nowMs: tickNow,
      isActive: myIsActive,
    });
    return myIsActive && displayed <= 0;
  }, [
    mode,
    myColor,
    state.whiteRemainingMs,
    state.blackRemainingMs,
    state.status,
    state.turnStartedAt,
    turn,
    tickNow,
  ]);

  const myTurn =
    state.status === "in_progress" &&
    !state.pending &&
    turn === myColor &&
    !myClockExpired;

  // Auto-claim opponent timeout (1s debounce; server validates).
  const opponentSide: "w" | "b" | null =
    myColor === "w" ? "b" : myColor === "b" ? "w" : null;
  const opponentRemainingMs =
    opponentSide === "w"
      ? state.whiteRemainingMs
      : opponentSide === "b"
        ? state.blackRemainingMs
        : null;
  const opponentIsActive =
    state.status === "in_progress" &&
    opponentSide !== null &&
    turn === opponentSide;
  useAutoClaim({
    gameId,
    mode,
    status: state.status,
    opponentRemainingMs,
    turnStartedAt: state.turnStartedAt,
    opponentIsActive,
  });

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
          setMoves((prev) => {
            if (prev.some((x) => x.ply === result.data.ply)) return prev;
            return [
              ...prev,
              {
                ply: result.data.ply,
                san: result.data.san,
                fen_after: result.data.fen_after,
              },
            ].sort((a, b) => a.ply - b.ply);
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
    (uci: string, optFen: string, san: string) => {
      // Optimistic ply = state.ply + 1. The server-confirm path uses the
      // same value as result.data.ply, and the dedup-by-ply guard in
      // submitMove + the realtime echo callback both skip when the entry
      // is already present. That keeps the move-list rendering of our
      // own move tied to piece-place time, not server-round-trip time.
      const optimisticPly = state.ply + 1;
      pendingMoveRef.current = { prevFen: state.fen, optFen, optimisticPly };
      setState((prev) => ({ ...prev, fen: optFen, pending: true }));
      setMoves((prev) => {
        if (prev.some((x) => x.ply === optimisticPly)) return prev;
        return [
          ...prev,
          { ply: optimisticPly, san, fen_after: optFen },
        ].sort((a, b) => a.ply - b.ply);
      });
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

      commitOptimisticAndSubmit(uci, local.fenAfter, local.san);
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

      commitOptimisticAndSubmit(uci, local.fenAfter, local.san);
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
          if (local.ok) commitOptimisticAndSubmit(uci, local.fenAfter, local.san);
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

  // Sidebar layout: viewer's pill always on the LEFT, opponent on the right,
  // turn pill in the middle. Observers (no myColor) default to white on the
  // left, mirroring the standard chess perspective.
  const leftSide: "w" | "b" = myColor ?? "w";
  const rightSide: "w" | "b" = leftSide === "w" ? "b" : "w";
  const activeSide: "w" | "b" | null = inProgress
    ? isWhitesTurn
      ? "w"
      : "b"
    : null;
  // Arrow points at the active player's pill: ◀ if active is on the left,
  // ▶ if active is on the right.
  const arrowChar = activeSide === leftSide ? "◀" : "▶";

  const renderPlayerPill = (side: "w" | "b") => {
    const isBlack = side === "b";
    const name = isBlack ? blackName : whiteName;
    const isYou = myColor === side;
    const isActive = activeSide === side;
    const overlay = checkOverlay(side);
    const remainingMs =
      side === "w" ? state.whiteRemainingMs : state.blackRemainingMs;
    const captured = side === "w" ? capturedByWhite : capturedByBlack;
    return (
      <div
        className={cn(
          // @container/pill: CapturedStrip queries this element's
          // inline-size to scale icon size + overlap to actual pill
          // width (which depends on layout, not viewport — at vw=320
          // each pill is ~110px, at vw=900+ each is ~280px).
          "@container/pill relative flex-1 rounded border px-3 py-2 transition-shadow overflow-hidden",
          isBlack
            ? "bg-black text-white border-black"
            : "bg-white text-black border-rule",
          isActive && "ring-2 ring-signal",
        )}
      >
        {overlay && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ backgroundColor: overlay }}
          />
        )}
        <div className="relative space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-wide opacity-60 flex items-center justify-between gap-2">
            <span>{isBlack ? "Black" : "White"}</span>
            {isYou && <span>(you)</span>}
          </p>
          <p className="font-display truncate">{name}</p>
          <CapturedStrip pieces={captured} />
          {mode !== "untimed" && (
            <Clock
              side={side === "w" ? "white" : "black"}
              mode={mode}
              remainingMs={remainingMs}
              turnStartedAt={state.turnStartedAt}
              isActive={Boolean(isActive)}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="container mx-auto max-w-6xl py-2 px-3 sm:py-8 sm:px-6 space-y-4">
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

      {/* Responsive layout via grid-template-areas. The status banner sits
          in a dedicated 'banner' row that spans both columns at lg+ so the
          stripe stretches across the board + move-list span. Single MoveList
          instance, repositioned by CSS:
          - mobile: stacked banner / board / pills / list
          - lg+: 2-column grid, banner spans full width, list pinned right of
            board (sticky on tall pages). */}
      <div
        className={cn(
          // Mobile: flex-col stack. Outer flex's children at mobile are
          // banner/board/pills (via display:contents on the inner
          // wrapper) plus the list wrapper at the end → stacked
          // banner / board / pills / list with gap-2 between.
          "flex flex-col gap-2",
          // Desktop (820+): outer becomes flex-row with two flex
          // items: the inner left wrapper (which switches from
          // display:contents to flex-col grouping banner/board/pills)
          // and the list wrapper. Cross-axis stretch (the flex
          // default) makes the list wrapper match the row height —
          // but because the list's *inner* scroll area is
          // position-absolute at desktop, the list contributes 0 to
          // row height. Row height = left column natural height. List
          // scrolls internally if its content exceeds.
          //
          // Outer width = sum of children naturally (left 576 fixed
          // + gap + list content-fit). max-w cap keeps it sane on
          // ultra-wide screens (576 board + 12 gap + 460 list cap =
          // 1048, rounded to 1068 for breathing room). Board stays
          // 576px the whole way — left column is basis-[576px]
          // shrink-0 so it never gives up width.
          "min-[820px]:flex-row min-[820px]:items-stretch min-[820px]:gap-x-3 min-[820px]:gap-y-0 min-[820px]:max-w-[1068px] min-[820px]:mx-auto",
        )}
      >
        {/* Left column wrapper. display:contents at mobile so the
            children flatten into the outer flex-col; switches to a
            real flex-col at 820+ so banner/board/pills group together
            as one flex-row item paired with the list wrapper.
            basis-[576px] + shrink-0 locks this column to the board's
            width — the list column gets whatever horizontal is left
            over, and the board never gets squeezed by it. */}
        <div className="contents min-[820px]:flex min-[820px]:flex-col min-[820px]:gap-2 min-[820px]:basis-[576px] min-[820px]:shrink-0 min-[820px]:min-w-0">
        <div className="max-w-xl mx-auto w-full min-[820px]:max-w-none">
          <InGameBanner
            status={state.status}
            currentTurn={turn ?? "w"}
            ply={state.ply}
            isObserver={isObserver}
          />
          <TerminalBanner
            status={state.status}
            terminationReason={state.terminationReason}
            isObserver={isObserver}
          />
        </div>
        <div className="flex justify-center">
          <div className="w-full max-w-xl aspect-square">
            <Chessboard
              position={displayFen}
              boardOrientation={myColor === "b" ? "black" : "white"}
              onPieceDrop={onPieceDrop}
              onPieceDragBegin={onPieceDragBegin}
              onPieceDragEnd={onPieceDragEnd}
              onPromotionPieceSelect={onPromotionPieceSelect}
              onSquareClick={onSquareClick}
              onMouseOverSquare={onSquareMouseOver}
              onMouseOutSquare={onSquareMouseOut}
              arePiecesDraggable={
                inProgress &&
                !isObserver &&
                scrubAnimDuration === null &&
                (viewedPly === null || viewedPly === livePly)
              }
              isDraggablePiece={isDraggablePiece}
              customSquareStyles={customSquareStyles}
              customBoardStyle={{ borderRadius: 6 }}
              customPieces={taylorPieces}
              animationDuration={scrubAnimDuration ?? 200}
            />
          </div>
        </div>

        {/* Player pills — viewer's pill always LEFT. Active side ringed signal. */}
        <aside className="flex items-stretch gap-2 max-w-xl mx-auto w-full text-sm min-[820px]:max-w-none">
          {renderPlayerPill(leftSide)}

          <div
            className={cn(
              // Below sm (640): w-auto + tight px-2 — content drives
              //   width (arrow + ply only, turnText hidden), pill
              //   collapses to ~50px so the player pills on either
              //   side keep their breathing room.
              // sm+ (>=640): w-[140px] fixed so the pill doesn't
              //   resize as turnText cycles through 'Your turn' (9
              //   chars) -> 'Opponent's turn' (15) -> 'Check — your
              //   move' (17). The growth was rebalancing the flex row,
              //   jiggling the player pills at every move flip; 140px
              //   fits the longest standard text + truncates longer
              //   observer strings.
              // shrink-0 on both: center never compresses below its
              //   own content; player pills (flex-1) absorb pressure
              //   first.
              "flex flex-col items-center justify-center rounded border px-2 sm:px-3 py-2 shrink-0 transition-colors sm:w-[140px]",
              !inProgress && "bg-bg-soft text-ink-soft border-rule-soft",
              whiteActive && "bg-white text-black border-rule",
              blackActive && "bg-black text-white border-black",
            )}
          >
            {/* Hidden below sm; arrow + ply alone communicate state on
                very narrow viewports. */}
            <span className="hidden sm:block font-mono uppercase tracking-wide text-[10px] truncate max-w-full text-center">
              {turnText}
            </span>
            {inProgress && (
              <span
                className="text-base leading-none mt-0.5"
                aria-hidden="true"
                title={whiteActive ? "white to move" : "black to move"}
              >
                {arrowChar}
              </span>
            )}
            <span className="font-mono text-[10px] tabular-nums opacity-60 mt-0.5">ply {state.ply}</span>
          </div>

          {renderPlayerPill(rightSide)}
        </aside>
        </div>{/* end left column wrapper (banner/board/pills) */}

        {/* List wrapper. At mobile is a normal block centered to
            max-w-xl matching banner/board/pills width. At 820+ is
            position-relative + fixed 180px wide (snug to the move
            list panel — list is single-column desktop). The inner
            flex-col is position-absolute filling this wrapper so
            (a) the list's natural height contributes 0 to flex-row
            row sizing — list height is bounded by row height (=
            banner + board + pills) and never extends past the pills'
            bottom — and (b) any list content beyond that height
            scrolls inside the panel. */}
        <div className="max-w-xl mx-auto w-full min-[820px]:relative min-[820px]:max-w-none min-[820px]:w-[180px] min-[820px]:shrink-0 min-[820px]:mx-0">
        <div className="space-y-2 min-[820px]:space-y-0 min-[820px]:absolute min-[820px]:inset-0 min-[820px]:flex min-[820px]:flex-col min-[820px]:gap-2">
          <MoveList
            moves={moves}
            livePly={livePly}
            viewedPly={viewedPly}
            onScrub={handleScrub}
            onPlay={() => handleScrub(null, { paceMs: 1000, isPlay: true })}
            isPlaying={isPlaying}
          />

          {/* Resign + abort buttons live alongside the move list so the
              right column owns all per-game controls. GameActions self-hides
              for observers and for non-active games. */}
          <GameActions
            gameId={gameId}
            status={state.status}
            ply={state.ply}
            isObserver={isObserver}
          />

          {/* Dev-only fool's mate smoke button. Hidden for observers and in
              prod bundles (gated on VERCEL_ENV at build time via the dynamic
              import above — `SmokeFoolsMate` resolves to null in prod). */}
          {SmokeFoolsMate && !isObserver && myColor && (
            <div className="flex items-center justify-center">
              <SmokeFoolsMate
                gameId={gameId}
                myColor={myColor}
                ply={state.ply}
                status={state.status}
              />
            </div>
          )}
        </div>{/* end list scroll wrapper */}
        </div>{/* end list outer wrapper */}
      </div>{/* end outer flex layout */}

      <ObserverCount
        gameId={gameId}
        myUserId={viewerUserId}
        isObserver={isObserver}
        initialTotal={initialObserverCount}
      />
    </main>
  );
}
