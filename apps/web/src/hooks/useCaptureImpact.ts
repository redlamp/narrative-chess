import { useEffect, useRef, useState } from "react";
import type { MoveRecord } from "@narrative-chess/content-schema";
import type { AnimatedPieceFrame } from "@/chessMotion";

type CaptureImpactState = {
  moveId: string;
  pieceId: string;
};

type AttackerSnapshot = {
  pieceId: string;
  progress: number;
  isMoving: boolean;
  displaySquare: AnimatedPieceFrame["displaySquare"];
};

type UseCaptureImpactOptions = {
  pieces: AnimatedPieceFrame[];
  lastMove: MoveRecord | null;
  durationMs?: number;
  fallbackTriggerProgress?: number;
};

export function useCaptureImpact({
  pieces,
  lastMove,
  durationMs = 280,
  fallbackTriggerProgress = 0.985
}: UseCaptureImpactOptions) {
  const [activeImpact, setActiveImpact] = useState<CaptureImpactState | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const previousCaptureMoveIdRef = useRef<string | null>(null);
  const triggeredMoveIdRef = useRef<string | null>(null);
  const previousAttackerRef = useRef<AttackerSnapshot | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const captureMoveId = lastMove?.capturedPieceId ? lastMove.id : null;
    if (captureMoveId !== previousCaptureMoveIdRef.current) {
      previousCaptureMoveIdRef.current = captureMoveId;
      triggeredMoveIdRef.current = null;
      previousAttackerRef.current = null;
    }

    if (!captureMoveId || !lastMove) {
      return;
    }

    const attacker = pieces.find((piece) => piece.pieceId === lastMove.pieceId) ?? null;
    const previousAttacker = previousAttackerRef.current;
    const arrivedOnDestination =
      Boolean(
        attacker &&
        !attacker.isMoving &&
        attacker.displaySquare === lastMove.to &&
        previousAttacker?.pieceId === attacker.pieceId &&
        previousAttacker.isMoving &&
        previousAttacker.progress >= 0.7
      );
    const nearlyArrivedWhileMoving = Boolean(attacker?.isMoving && attacker.progress >= fallbackTriggerProgress);

    if (
      attacker &&
      triggeredMoveIdRef.current !== captureMoveId &&
      (arrivedOnDestination || nearlyArrivedWhileMoving)
    ) {
      triggeredMoveIdRef.current = captureMoveId;
      setActiveImpact({
        moveId: captureMoveId,
        pieceId: attacker.pieceId
      });

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setActiveImpact((current) => (current?.moveId === captureMoveId ? null : current));
        timeoutRef.current = null;
      }, durationMs);
    }

    previousAttackerRef.current = attacker
      ? {
          pieceId: attacker.pieceId,
          progress: attacker.progress,
          isMoving: attacker.isMoving,
          displaySquare: attacker.displaySquare
        }
      : null;
  }, [durationMs, fallbackTriggerProgress, lastMove, pieces]);

  return activeImpact;
}
