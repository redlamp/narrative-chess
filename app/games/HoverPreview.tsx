"use client";

/**
 * Fly-out "page" panel that animates out from a book card's right edge on
 * hover. Holds a MiniBoard preview of the game's current FEN + a few lines of
 * editorial metadata.
 *
 * The panel is absolutely positioned relative to its book-card parent so it
 * "opens" from the spine. Pointer-events are tied to the parent's hover state
 * — the panel itself is pointer-events-none so it doesn't trap the cursor or
 * trigger flicker on overlapping cards.
 */

import { MiniBoard } from "./MiniBoard";

type Props = {
  fen: string;
  orientation: "white" | "black" | null;
  lastMoveUci?: string | null;
  /** Top eyebrow line — e.g. "AWAITING CHALLENGER" or "WHITE TO MOVE" */
  eyebrow: string;
  /** Optional ply count rendered as a footer detail */
  plyLabel?: string;
  /** Optional last move SAN — printed below board, e.g. "23... Rxb6" */
  lastMoveSan?: string | null;
};

export function HoverPreview({
  fen,
  orientation,
  lastMoveUci,
  eyebrow,
  plyLabel,
  lastMoveSan,
}: Props) {
  return (
    <div
      aria-hidden
      className="book-preview pointer-events-none absolute top-0 left-full ml-3 z-30 origin-left"
    >
      <div
        className="book-preview-page rounded-[3px] p-4 backdrop-blur-[2px]"
        style={{
          background:
            "linear-gradient(180deg, var(--background) 0%, var(--bg-soft) 100%)",
          boxShadow:
            "0 20px 40px -12px rgba(0,0,0,0.35), 0 4px 8px -4px rgba(0,0,0,0.18), inset 1px 0 0 rgba(255,255,255,0.4)",
          borderTop: "1px solid var(--rule-soft)",
          borderRight: "1px solid var(--rule-soft)",
          borderBottom: "1px solid var(--rule-soft)",
          // Paper-curl: subtle gradient on left edge fakes the page binding
          borderLeft: "1px solid var(--oxblood)",
        }}
      >
        <p
          className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink-faint mb-2"
          style={{ color: "var(--oxblood)" }}
        >
          {eyebrow}
        </p>
        <MiniBoard
          fen={fen}
          orientation={orientation ?? "white"}
          lastMoveUci={lastMoveUci ?? null}
          size={28}
        />
        <div className="mt-3 flex items-baseline justify-between gap-3">
          {lastMoveSan ? (
            <span className="font-display italic text-sm text-foreground">
              {lastMoveSan}
            </span>
          ) : (
            <span className="font-display italic text-sm text-ink-soft">
              starting position
            </span>
          )}
          {plyLabel && (
            <span className="font-mono text-[10px] text-ink-faint tabular-nums">
              {plyLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
