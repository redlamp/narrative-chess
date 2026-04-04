import { useState } from "react";
import {
  applyMove,
  createInitialGameSnapshot,
  getBoardSquares,
  getPieceAtSquare,
  listLegalMoves,
  undoLastMove
} from "@narrative-chess/game-core";
import {
  createInitialCharacterRoster,
  createNarrativeEvent
} from "@narrative-chess/narrative-engine";
import type {
  CharacterSummary,
  GameSnapshot,
  MoveRecord,
  PieceState,
  Square
} from "@narrative-chess/content-schema";

function createFallbackCharacter(piece: PieceState): CharacterSummary {
  const sideLabel = piece.side === "white" ? "North" : "South";

  return {
    id: piece.pieceId,
    pieceId: piece.pieceId,
    side: piece.side,
    pieceKind: piece.kind,
    fullName: `${sideLabel} ${piece.kind[0].toUpperCase()}${piece.kind.slice(1)}`,
    role: piece.kind,
    districtOfOrigin: "Central Ward",
    faction: piece.side === "white" ? "White Directorate" : "Black Assembly",
    traits: ["focused", "observant", "steady", "guarded"],
    verbs: ["advance", "hold", "pressure", "defend"],
    oneLineDescription: "A lightweight fallback character for local play.",
    generationSource: "web-fallback",
    generationModel: null,
    contentStatus: "procedural",
    reviewStatus: "empty",
    reviewNotes: null,
    lastReviewedAt: null
  };
}

function isPromotionMove(piece: PieceState | null, to: Square): boolean {
  if (!piece || piece.kind !== "pawn") {
    return false;
  }

  return (piece.side === "white" && to.endsWith("8")) || (piece.side === "black" && to.endsWith("1"));
}

function createSnapshot(): GameSnapshot {
  const characters = createInitialCharacterRoster();
  return createInitialGameSnapshot(characters);
}

export function useChessMatch() {
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => createSnapshot());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const selectedPiece = selectedSquare ? getPieceAtSquare(snapshot, selectedSquare) : null;
  const selectedCharacter = selectedPiece ? snapshot.characters[selectedPiece.pieceId] ?? null : null;
  const legalMoves = selectedSquare ? listLegalMoves(snapshot, selectedSquare) : [];
  const boardSquares = getBoardSquares(snapshot);
  const canUndo = snapshot.moveHistory.length > 0;
  const lastMove = snapshot.moveHistory.at(-1) ?? null;

  const commitMove = (from: Square, to: Square) => {
    const movingPiece = getPieceAtSquare(snapshot, from);
    if (!movingPiece) {
      return false;
    }

    const appliedMove = applyMove(snapshot, {
      from,
      to,
      promotion: isPromotionMove(movingPiece, to) ? "q" : undefined
    });

    if (!appliedMove) {
      return false;
    }

    const actor = snapshot.characters[movingPiece.pieceId] ?? createFallbackCharacter(movingPiece);
    const targetPiece = appliedMove.move.capturedPieceId
      ? snapshot.characters[appliedMove.move.capturedPieceId] ?? null
      : null;

    const event = createNarrativeEvent({
      move: appliedMove.move as MoveRecord,
      actor,
      target: targetPiece
    });

    setSnapshot({
      ...appliedMove.nextState,
      eventHistory: [...snapshot.eventHistory, event]
    });
    setSelectedSquare(null);
    return true;
  };

  const handleSquareClick = (square: Square) => {
    if (selectedSquare) {
      const legalTarget = legalMoves.includes(square);
      if (legalTarget) {
        commitMove(selectedSquare, square);
        return;
      }
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    const piece = getPieceAtSquare(snapshot, square);
    if (piece) {
      setSelectedSquare(square);
      return;
    }

    setSelectedSquare(null);
  };

  const handleUndo = () => {
    const previous = undoLastMove(snapshot);
    if (!previous) {
      return;
    }

    setSnapshot(previous);
    setSelectedSquare(null);
  };

  return {
    snapshot,
    boardSquares,
    selectedSquare,
    selectedPiece,
    selectedCharacter,
    legalMoves,
    canUndo,
    lastMove,
    handleSquareClick,
    handleUndo
  };
}
