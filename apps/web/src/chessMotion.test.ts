import { describe, expect, it } from "vitest";
import { applyMove, createInitialGameSnapshot } from "@narrative-chess/game-core";
import { getAnimatedPieceFrames } from "./chessMotion";

describe("chessMotion", () => {
  it("interpolates a moving piece between snapshots", () => {
    const start = createInitialGameSnapshot({});
    const firstMove = applyMove(start, { from: "e2", to: "e4" });
    expect(firstMove).not.toBeNull();

    const frames = getAnimatedPieceFrames({
      snapshots: [start, firstMove!.nextState],
      playhead: 0.5
    });
    const movingPawn = frames.find((piece) => piece.pieceId === "white-pawn-e");

    expect(movingPawn).toMatchObject({
      fromSquare: "e2",
      toSquare: "e4",
      isMoving: true,
      opacity: 1
    });
    expect(movingPawn?.progress).toBeCloseTo(0.5, 6);
  });

  it("keeps captured pieces visible while fading them out between plies", () => {
    const start = createInitialGameSnapshot({});
    const firstMove = applyMove(start, { from: "e2", to: "e4" });
    const secondMove = applyMove(firstMove!.nextState, { from: "d7", to: "d5" });
    const thirdMove = applyMove(secondMove!.nextState, { from: "e4", to: "d5" });

    expect(thirdMove).not.toBeNull();

    const frames = getAnimatedPieceFrames({
      snapshots: [secondMove!.nextState, thirdMove!.nextState],
      playhead: 0.5
    });
    const lateFrames = getAnimatedPieceFrames({
      snapshots: [secondMove!.nextState, thirdMove!.nextState],
      playhead: 0.95
    });
    const capturedPawn = frames.find((piece) => piece.pieceId === "black-pawn-d");
    const capturingPawn = frames.find((piece) => piece.pieceId === "white-pawn-e");
    const lateCapturedPawn = lateFrames.find((piece) => piece.pieceId === "black-pawn-d");

    expect(capturedPawn).toMatchObject({
      fromSquare: "d5",
      toSquare: null,
      opacity: 1
    });
    expect(capturingPawn).toMatchObject({
      fromSquare: "e4",
      toSquare: "d5"
    });
    expect(capturingPawn?.progress).toBeCloseTo(0.5, 6);
    expect(lateCapturedPawn?.opacity).toBeLessThan(1);
  });
});
