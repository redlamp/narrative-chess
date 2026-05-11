/**
 * Tiny static FEN board used inline on book cards at mobile widths in place
 * of the cursor-following preview (which has no equivalent on touch).
 *
 * Pure render — no animations, no captures, no last-move highlight. Just an
 * 8×8 grid of squares with Taylor SVG pieces. Defaults to a 10px square (80
 * × 80 board) so the whole component fits in the right gutter of a book
 * page even on a 320px-wide phone.
 */

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

function parsePlacement(fen: string): (string | null)[][] {
  const placement = fen.split(/\s+/)[0] ?? "";
  const rows: (string | null)[][] = [];
  for (const rank of placement.split("/")) {
    const row: (string | null)[] = [];
    for (const ch of rank) {
      if (/[1-8]/.test(ch)) {
        for (let i = 0; i < Number(ch); i++) row.push(null);
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

type Props = {
  fen: string;
  /** Square dimension in px. Defaults to 10 → 80px board. */
  size?: number;
};

export function StaticBoard({ fen, size = 10 }: Props) {
  const grid = parsePlacement(fen);
  return (
    <div
      className="grid grid-cols-8 rounded-[2px] overflow-hidden ring-1 ring-rule-soft/60 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.30)]"
      style={{ width: size * 8, height: size * 8 }}
      aria-hidden
    >
      {grid.flat().map((piece, i) => {
        const rank = Math.floor(i / 8);
        const file = i % 8;
        const light = (rank + file) % 2 === 0;
        return (
          <div
            key={i}
            className="relative"
            style={{
              width: size,
              height: size,
              background: light
                ? "var(--mini-board-light, #e8dcc4)"
                : "var(--mini-board-dark, #8a6a45)",
            }}
          >
            {piece && (
              // eslint-disable-next-line @next/next/no-img-element -- static SVG asset, see piece-set.tsx note
              <img
                src={`/pieces/taylor/${piece}.svg`}
                alt=""
                width={size}
                height={size}
                draggable={false}
                style={{ pointerEvents: "none", display: "block" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
