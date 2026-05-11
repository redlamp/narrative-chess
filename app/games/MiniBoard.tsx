"use client";

/**
 * Tiny FEN-only board for hover previews on the games library page.
 *
 * Renders a static 8x8 grid w/ Taylor SVG pieces, no react-chessboard. Cheap
 * enough to mount per-hover but light enough that mounting one per card upfront
 * would still be fine if we ever wanted to. No interactions, no realtime, no
 * legal-move highlights — last-move highlight is optional via `lastMoveUci`.
 *
 * Orientation: viewer-side at the bottom. If the viewer plays black we flip;
 * for spectators (no side) we default to white-bottom.
 */

type Props = {
  fen: string;
  /** Viewer side. `null` for spectator / open challenge — defaults to white-bottom. */
  orientation?: "white" | "black" | null;
  /** Last move UCI like `e2e4`. Highlights from + to squares in oxblood wash. */
  lastMoveUci?: string | null;
  /** Square dimension in px. Total board = size * 8. */
  size?: number;
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

// FEN char → Taylor piece file key
const PIECE_FILE: Record<string, string> = {
  P: "wp",
  N: "wn",
  B: "wb",
  R: "wr",
  Q: "wq",
  K: "wk",
  p: "bp",
  n: "bn",
  b: "bb",
  r: "br",
  q: "bq",
  k: "bk",
};

function parseFileGrid(fen: string): (string | null)[][] {
  const placement = fen.split(/\s+/)[0] ?? "";
  const rows: (string | null)[][] = [];
  for (const rank of placement.split("/")) {
    const row: (string | null)[] = [];
    for (const ch of rank) {
      if (/[1-8]/.test(ch)) {
        const n = Number(ch);
        for (let i = 0; i < n; i++) row.push(null);
      } else {
        row.push(PIECE_FILE[ch] ?? null);
      }
    }
    while (row.length < 8) row.push(null);
    rows.push(row);
  }
  while (rows.length < 8) rows.push(new Array(8).fill(null));
  return rows;
}

function squareName(rankIdx: number, fileIdx: number): string {
  // rankIdx 0 = rank 8, 7 = rank 1. fileIdx 0 = file a.
  return `${FILES[fileIdx]}${8 - rankIdx}`;
}

export function MiniBoard({
  fen,
  orientation = "white",
  lastMoveUci,
  size = 30,
}: Props) {
  const fileGrid = parseFileGrid(fen);

  const flipped = orientation === "black";
  const fromSq = lastMoveUci?.slice(0, 2) ?? null;
  const toSq = lastMoveUci?.slice(2, 4) ?? null;

  const ranks = flipped ? [...fileGrid].reverse() : fileGrid;
  const fileOrder = flipped ? [...FILES].reverse() : FILES;

  return (
    <div
      className="grid grid-cols-8 shrink-0 rounded-[2px] overflow-hidden ring-1 ring-rule-soft/70 shadow-[0_6px_18px_-8px_rgba(0,0,0,0.45)]"
      style={{ width: size * 8, height: size * 8 }}
      aria-hidden
    >
      {ranks.map((row, rIdx) => {
        const sourceRankIdx = flipped ? 7 - rIdx : rIdx;
        const cells = flipped ? [...row].reverse() : row;
        return cells.map((file, cIdx) => {
          const sourceFileIdx = flipped ? 7 - cIdx : cIdx;
          const sq = squareName(sourceRankIdx, sourceFileIdx);
          const lightSquare = (sourceRankIdx + sourceFileIdx) % 2 === 0;
          const isFrom = fromSq === sq;
          const isTo = toSq === sq;
          return (
            <div
              key={`${rIdx}-${cIdx}`}
              className="relative"
              style={{
                width: size,
                height: size,
                background: lightSquare
                  ? "var(--mini-board-light, #e8dcc4)"
                  : "var(--mini-board-dark, #8a6a45)",
              }}
            >
              {(isFrom || isTo) && (
                <div
                  className="absolute inset-0"
                  style={{
                    background: "var(--oxblood)",
                    mixBlendMode: "multiply",
                    opacity: 0.34,
                  }}
                />
              )}
              {file && (
                // eslint-disable-next-line @next/next/no-img-element -- static SVG asset, cached
                <img
                  src={`/pieces/taylor/${file}.svg`}
                  alt=""
                  width={size}
                  height={size}
                  draggable={false}
                  className="relative block"
                  style={{ pointerEvents: "none" }}
                />
              )}
              {/* File label on bottom row, rank label on left col — micro detail.
                  Loops iterate display order, so the bottom row is always
                  rIdx===7 and the left col is always cIdx===0 regardless of
                  orientation. */}
              {rIdx === 7 && (
                <span
                  className="absolute right-[2px] bottom-[1px] font-mono"
                  style={{
                    fontSize: Math.max(7, size * 0.28),
                    lineHeight: 1,
                    color: lightSquare ? "rgba(58, 42, 25, 0.55)" : "rgba(245, 232, 210, 0.65)",
                  }}
                >
                  {fileOrder[cIdx]}
                </span>
              )}
              {cIdx === 0 && (
                <span
                  className="absolute left-[2px] top-[1px] font-mono"
                  style={{
                    fontSize: Math.max(7, size * 0.28),
                    lineHeight: 1,
                    color: lightSquare ? "rgba(58, 42, 25, 0.55)" : "rgba(245, 232, 210, 0.65)",
                  }}
                >
                  {flipped ? rIdx + 1 : 8 - rIdx}
                </span>
              )}
            </div>
          );
        });
      })}
    </div>
  );
}
