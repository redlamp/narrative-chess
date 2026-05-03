/**
 * Centralized re-export of the few react-chessboard types we consume.
 *
 * react-chessboard@4.x doesn't expose Piece/Square/PromotionPieceOption
 * from its public entry — they live under `dist/chessboard/types`, which
 * is a build artifact and not part of the package's semver surface. By
 * keeping the deep import in this single file, a future
 * react-chessboard restructure changes one path here instead of every
 * consumer.
 *
 * If/when react-chessboard exposes these from the package root, replace
 * the deep import below with `from "react-chessboard"` and the rest of
 * the codebase keeps importing from `@/lib/chess/board-types`.
 */
export type {
  Piece,
  PromotionPieceOption,
  Square,
} from "react-chessboard/dist/chessboard/types";
