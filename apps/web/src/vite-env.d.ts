/// <reference types="vite/client" />

declare module "@narrative-chess/game-core" {
  import type {
    CharacterSummary,
    GameSnapshot,
    MoveApplication,
    PieceState,
    Square
  } from "@narrative-chess/content-schema";

  export function createInitialGameSnapshot(
    characters: Record<string, CharacterSummary>
  ): GameSnapshot;

  export function listLegalMoves(snapshot: GameSnapshot, square: Square): Square[];

  export function applyMove(
    snapshot: GameSnapshot,
    move: { from: Square; to: Square; promotion?: "q" | "r" | "b" | "n" }
  ): MoveApplication | null;

  export function undoLastMove(snapshot: GameSnapshot): GameSnapshot | null;

  export function getPieceAtSquare(
    snapshot: GameSnapshot,
    square: Square
  ): PieceState | null;

  export function getBoardSquares(snapshot: GameSnapshot): Array<{
    square: Square;
    occupant: PieceState | null;
    isLight: boolean;
  }>;
}

declare module "@narrative-chess/narrative-engine" {
  import type {
    CharacterSummary,
    MoveRecord,
    NarrativeEvent
  } from "@narrative-chess/content-schema";

  export function createInitialCharacterRoster(): Record<string, CharacterSummary>;

  export function createNarrativeEvent(input: {
    move: MoveRecord;
    actor: CharacterSummary;
    target?: CharacterSummary | null;
  }): NarrativeEvent;
}
