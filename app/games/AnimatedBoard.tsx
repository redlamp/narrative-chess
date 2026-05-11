"use client";

/**
 * The mini-board rendered inside the floating cursor preview. Unlike a static
 * board, this one keeps the *same* piece instances alive across FEN changes
 * and tweens them between board squares so that switching between two games
 * reads as "the pieces rearranging themselves" rather than "one board fades
 * into another".
 *
 * Two interesting moves:
 *
 *   1. Identity matching by nearest neighbour. For each (color, type) cohort
 *      we greedy-match instances in the previous frame to squares in the
 *      next frame, picking the closest unused pair first. This means a knight
 *      that's on b1 in game A and on c3 in game B tweens b1 → c3 instead of
 *      teleporting.
 *
 *   2. Captured pile. Pieces that exist in the previous frame but not the
 *      next slide down to a strip above/below the board (above = pieces the
 *      top side has captured; below = pieces the bottom side has captured).
 *      Conversely, pieces that materialise on the new FEN spawn from the
 *      pile into their target square (so going *back* to the earlier game
 *      reads as "pieces flowing back onto the board").
 *
 * Implementation is intentionally state-based rather than GSAP — every piece
 * is an absolutely-positioned <img> with a CSS transition on transform +
 * opacity. React diff + stable keys do the rest.
 */

import { useEffect, useRef, useState } from "react";

type Color = "w" | "b";
type Type = "p" | "n" | "b" | "r" | "q" | "k";

type PieceLoc =
  | { kind: "board"; rank: number; file: number }
  | { kind: "captured"; side: Color; slot: number };

type Piece = {
  id: string;
  color: Color;
  type: Type;
  loc: PieceLoc;
  /** 0 = fading out, 1 = visible. Drives CSS opacity transition. */
  opacity: number;
};

type Props = {
  fen: string;
  /** Viewer side; controls board orientation. `null` → white-bottom default. */
  orientation: "white" | "black" | null;
  /** Square dimension in px. Board = 8 × size; captured strips = 0.6 × size tall. */
  size?: number;
};

const PIECE_FILE: Record<string, { color: Color; type: Type }> = {
  P: { color: "w", type: "p" },
  N: { color: "w", type: "n" },
  B: { color: "w", type: "b" },
  R: { color: "w", type: "r" },
  Q: { color: "w", type: "q" },
  K: { color: "w", type: "k" },
  p: { color: "b", type: "p" },
  n: { color: "b", type: "n" },
  b: { color: "b", type: "b" },
  r: { color: "b", type: "r" },
  q: { color: "b", type: "q" },
  k: { color: "b", type: "k" },
};

// Starting material per side — used to compute "captured" = starting - on-board.
const STARTING: Record<Type, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

// Captured-strip ordering — high-value pieces sit nearest the board edge.
const CAPTURED_ORDER: Type[] = ["q", "r", "b", "n", "p"];

type Target = { color: Color; type: Type; rank: number; file: number };

/**
 * Parse a FEN's placement field into a flat list of (color, type, rank, file)
 * tuples. rank 0 = rank 1, rank 7 = rank 8. file 0 = a, file 7 = h.
 */
function parseFen(fen: string): Target[] {
  const placement = fen.split(/\s+/)[0] ?? "";
  const rows = placement.split("/");
  const out: Target[] = [];
  // FEN ranks are listed top-down 8 → 1.
  for (let i = 0; i < rows.length && i < 8; i++) {
    const rank = 7 - i; // FEN row 0 = rank 8 → rank index 7
    let file = 0;
    for (const ch of rows[i]) {
      if (/[1-8]/.test(ch)) {
        file += Number(ch);
        continue;
      }
      const entry = PIECE_FILE[ch];
      if (entry) {
        out.push({ color: entry.color, type: entry.type, rank, file });
        file++;
      }
    }
  }
  return out;
}

function distance(a: { rank: number; file: number }, b: { rank: number; file: number }): number {
  const dr = a.rank - b.rank;
  const df = a.file - b.file;
  return dr * dr + df * df;
}

function groupKey(c: Color, t: Type): string {
  return `${c}${t}`;
}

/**
 * Pure transition: given previous pieces + next FEN's targets, return the
 * piece array for the next frame. Matched instances keep their `id`; new
 * instances get a fresh id; pieces with no match in the new FEN drift to the
 * captured strip and fade.
 */
function nextPieces(prev: Piece[], targets: Target[]): Piece[] {
  // Group prev by (color, type), keeping only those currently on a board
  // square. Captured + fading pieces are tracked separately so the prior
  // captured strip stays stable when nothing about them changed.
  const prevByGroup = new Map<string, Piece[]>();
  const captured: Piece[] = [];
  for (const p of prev) {
    if (p.opacity <= 0.05) continue; // already faded out → garbage-collect
    if (p.loc.kind === "captured") {
      captured.push(p);
    } else {
      const k = groupKey(p.color, p.type);
      const arr = prevByGroup.get(k) ?? [];
      arr.push(p);
      prevByGroup.set(k, arr);
    }
  }

  // Group targets by (color, type).
  const targetsByGroup = new Map<string, Target[]>();
  for (const t of targets) {
    const k = groupKey(t.color, t.type);
    const arr = targetsByGroup.get(k) ?? [];
    arr.push(t);
    targetsByGroup.set(k, arr);
  }

  const out: Piece[] = [];
  const usedIds = new Set<string>();

  // For each (color, type) cohort, greedy-match prev → targets by distance.
  const allKeys = new Set<string>([...prevByGroup.keys(), ...targetsByGroup.keys()]);
  for (const k of allKeys) {
    const prevs = prevByGroup.get(k) ?? [];
    const targs = targetsByGroup.get(k) ?? [];

    // Compute all pairwise (prevIdx, targIdx, distance) and sort ascending.
    type Pair = { pi: number; ti: number; d: number };
    const pairs: Pair[] = [];
    for (let pi = 0; pi < prevs.length; pi++) {
      const p = prevs[pi];
      if (p.loc.kind !== "board") continue;
      for (let ti = 0; ti < targs.length; ti++) {
        pairs.push({ pi, ti, d: distance(p.loc, targs[ti]) });
      }
    }
    pairs.sort((a, b) => a.d - b.d);

    const matchedPrev = new Set<number>();
    const matchedTarg = new Set<number>();
    for (const { pi, ti } of pairs) {
      if (matchedPrev.has(pi) || matchedTarg.has(ti)) continue;
      matchedPrev.add(pi);
      matchedTarg.add(ti);
      const prevPiece = prevs[pi];
      const targ = targs[ti];
      out.push({
        id: prevPiece.id,
        color: prevPiece.color,
        type: prevPiece.type,
        loc: { kind: "board", rank: targ.rank, file: targ.file },
        opacity: 1,
      });
      usedIds.add(prevPiece.id);
    }

    // Unmatched prev → drift to the captured strip on the piece's *own*
    // starting side, so a captured white pawn lands near the bottom (where
    // white started) and a captured black pawn near the top. Minimises the
    // tween distance off the board: a piece that's about to be captured was
    // by definition still on the board, but rarely far from its starting
    // half. Real slot index is assigned below once cohort sizes are known.
    for (let pi = 0; pi < prevs.length; pi++) {
      if (matchedPrev.has(pi)) continue;
      const p = prevs[pi];
      if (p.loc.kind !== "board") continue;
      out.push({
        id: p.id,
        color: p.color,
        type: p.type,
        loc: { kind: "captured", side: p.color, slot: -1 },
        opacity: 1,
      });
      usedIds.add(p.id);
    }

    // Unmatched target → spawn new instance.
    for (let ti = 0; ti < targs.length; ti++) {
      if (matchedTarg.has(ti)) continue;
      const t = targs[ti];
      out.push({
        id: `${k}-${t.rank}${t.file}-${Math.random().toString(36).slice(2, 8)}`,
        color: t.color,
        type: t.type,
        loc: { kind: "board", rank: t.rank, file: t.file },
        opacity: 1,
      });
    }
  }

  // Keep prior captured pieces around but recompute their slots so the strip
  // reflects the new FEN's captured set deterministically. Pieces that are
  // captured-in-the-new-FEN-but-weren't-already-tracked get fresh ids.
  // We assemble per side, by type-order, the captured count and place them.
  const onBoard: Record<string, number> = {};
  for (const t of targets) {
    const k = groupKey(t.color, t.type);
    onBoard[k] = (onBoard[k] ?? 0) + 1;
  }

  // For each side, build an ordered list of captured (color, type) entries
  // — the *opposite* color, ordered by piece value desc, with counts =
  // STARTING[type] - onBoard[opp+type].
  function capturedList(capturedSide: Color): { color: Color; type: Type }[] {
    const enemy: Color = capturedSide === "w" ? "b" : "w";
    const out: { color: Color; type: Type }[] = [];
    for (const type of CAPTURED_ORDER) {
      const have = onBoard[groupKey(enemy, type)] ?? 0;
      const start = STARTING[type];
      const missing = Math.max(0, start - have);
      for (let i = 0; i < missing; i++) out.push({ color: enemy, type });
    }
    return out;
  }

  const whiteCaptures = capturedList("w"); // pieces white has captured (black pieces)
  const blackCaptures = capturedList("b"); // pieces black has captured (white pieces)

  // Now assign captured pieces from `out` into these slot lists.
  // Strategy: for each side+type, the captured-list slot order is fixed by
  // CAPTURED_ORDER. We find captured pieces in `out` matching (capturedSide,
  // type) and assign them slots 0..N-1 in order. Prefer reusing pieces that
  // came in already-captured (preserves their id+position).
  function assignSlots(
    capturedSide: Color,
    list: { color: Color; type: Type }[],
  ): void {
    let slot = 0;
    const claimedIds = new Set<string>();
    for (const target of list) {
      // Find an existing captured piece in `out` matching this target.
      const existingIdx = out.findIndex(
        (p) =>
          p.color === target.color &&
          p.type === target.type &&
          p.loc.kind === "captured" &&
          p.loc.side === capturedSide &&
          !claimedIds.has(p.id),
      );
      if (existingIdx >= 0) {
        out[existingIdx].loc = { kind: "captured", side: capturedSide, slot };
        out[existingIdx].opacity = 1;
        claimedIds.add(out[existingIdx].id);
      } else {
        // Look for any *previously* captured piece in the carry-over list.
        const carryIdx = captured.findIndex(
          (p) =>
            p.color === target.color &&
            p.type === target.type &&
            p.loc.kind === "captured" &&
            p.loc.side === capturedSide &&
            !claimedIds.has(p.id),
        );
        if (carryIdx >= 0) {
          const c = captured[carryIdx];
          out.push({
            ...c,
            loc: { kind: "captured", side: capturedSide, slot },
            opacity: 1,
          });
          claimedIds.add(c.id);
        } else {
          // No prior instance — spawn from board edge with a fresh id.
          out.push({
            id: `cap-${capturedSide}-${target.type}-${slot}-${Math.random().toString(36).slice(2, 8)}`,
            color: target.color,
            type: target.type,
            loc: { kind: "captured", side: capturedSide, slot },
            opacity: 1,
          });
        }
      }
      slot++;
    }
  }

  // capturedSide here = the COLOR of the captured pieces (= the side they
  // started on), not the side that captured them. whiteCaptures is the list
  // of pieces white has taken (i.e. black pieces) → those sit on black's
  // strip (top) so they barely move from their starting half.
  assignSlots("b", whiteCaptures);
  assignSlots("w", blackCaptures);

  // Any leftover captured pieces in `out` with slot === -1 (unmatched in the
  // new lists — only happens if the new FEN has MORE of a piece type than
  // before, which is unusual mid-game but possible across unrelated games):
  // fade them out.
  for (const p of out) {
    if (p.loc.kind === "captured" && p.loc.slot === -1) {
      p.opacity = 0;
    }
  }

  return out;
}

function pieceFileName(color: Color, type: Type): string {
  return `${color}${type}`;
}

export function AnimatedBoard({ fen, orientation, size = 32 }: Props) {
  const flipped = orientation === "black";
  const [pieces, setPieces] = useState<Piece[]>([]);
  const prevFenRef = useRef<string>("");

  useEffect(() => {
    if (prevFenRef.current === fen) return;
    prevFenRef.current = fen;
    const targets = parseFen(fen);
    setPieces((prev) => nextPieces(prev, targets));
  }, [fen]);

  const boardPx = size * 8;
  const stripHeight = Math.round(size * 0.6);
  const capturedSize = Math.round(size * 0.7);
  // Slot spacing in captured strip — overlap so a full pawn row fits.
  const slotStep = Math.round(capturedSize * 0.6);

  // Compute display coords for a piece.
  function pieceXY(p: Piece): { x: number; y: number; opacity: number; scale: number } {
    if (p.loc.kind === "board") {
      const displayRank = flipped ? p.loc.rank : 7 - p.loc.rank; // y-axis: 0 = top
      const displayFile = flipped ? 7 - p.loc.file : p.loc.file;
      return {
        x: displayFile * size,
        y: stripHeight + displayRank * size,
        opacity: p.opacity,
        scale: 1,
      };
    }
    // Captured. Top strip (y = 0..stripHeight) holds pieces captured by the
    // TOP-SIDE displayed (so above-board strip = enemies-of-bottom-side
    // captured by top-side = pieces the bottom side has lost).
    const bottomSide: Color = flipped ? "b" : "w";
    const isTopStrip = p.loc.side !== bottomSide;
    const slotX = boardPx - capturedSize - p.loc.slot * slotStep;
    const slotY = isTopStrip
      ? (stripHeight - capturedSize) / 2
      : stripHeight + boardPx + (stripHeight - capturedSize) / 2;
    return {
      x: Math.max(0, slotX),
      y: slotY,
      opacity: p.opacity,
      scale: 0.7 * (capturedSize / size),
    };
  }

  // Render board squares as a static grid behind pieces.
  const squares: { x: number; y: number; light: boolean }[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const light = (r + c) % 2 === 0;
      squares.push({ x: c * size, y: stripHeight + r * size, light });
    }
  }

  const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const fileLabels = flipped ? [...FILES].reverse() : FILES;

  return (
    <div
      className="relative"
      style={{
        width: boardPx,
        height: stripHeight * 2 + boardPx,
      }}
      aria-hidden
    >
      {/* Captured-strip backdrops — subtle ruled lines, nothing more. */}
      <div
        className="absolute left-0 right-0"
        style={{
          top: stripHeight - 1,
          height: 1,
          background:
            "linear-gradient(90deg, transparent 0%, var(--ink-faint-border) 10%, var(--ink-faint-border) 90%, transparent 100%)",
          opacity: 0.45,
        }}
      />
      <div
        className="absolute left-0 right-0"
        style={{
          top: stripHeight + boardPx,
          height: 1,
          background:
            "linear-gradient(90deg, transparent 0%, var(--ink-faint-border) 10%, var(--ink-faint-border) 90%, transparent 100%)",
          opacity: 0.45,
        }}
      />

      {/* Board squares */}
      <div
        className="absolute rounded-[2px] overflow-hidden ring-1 ring-rule-soft/70"
        style={{
          top: stripHeight,
          left: 0,
          width: boardPx,
          height: boardPx,
        }}
      >
        {squares.map((sq, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: sq.x,
              top: sq.y - stripHeight,
              width: size,
              height: size,
              background: sq.light
                ? "var(--mini-board-light, #e8dcc4)"
                : "var(--mini-board-dark, #8a6a45)",
            }}
          />
        ))}
        {/* File labels on the bottom rank */}
        {fileLabels.map((f, i) => (
          <span
            key={`f-${f}`}
            className="absolute font-mono"
            style={{
              left: i * size + size - 8,
              top: boardPx - 11,
              fontSize: Math.max(7, size * 0.24),
              lineHeight: 1,
              color: "rgba(58, 42, 25, 0.55)",
            }}
          >
            {f}
          </span>
        ))}
      </div>

      {/* Pieces */}
      {pieces.map((p) => {
        const { x, y, opacity, scale } = pieceXY(p);
        const file = pieceFileName(p.color, p.type);
        return (
          // eslint-disable-next-line @next/next/no-img-element -- static SVG asset, see piece-set.tsx note
          <img
            key={p.id}
            src={`/pieces/taylor/${file}.svg`}
            alt=""
            draggable={false}
            className="absolute board-piece pointer-events-none select-none"
            style={{
              left: 0,
              top: 0,
              width: size,
              height: size,
              transform: `translate(${x}px, ${y}px) scale(${scale})`,
              transformOrigin: "top left",
              opacity,
            }}
          />
        );
      })}
    </div>
  );
}
