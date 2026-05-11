"use client";

/**
 * Floating, fixed-positioned preview panel that follows the cursor. Mounts
 * once at the library root; subscribes to the hover context to know which
 * game's FEN to render. Cursor tracking is decoupled from React state — the
 * positioning layer is a ref whose transform is mutated directly on each
 * mousemove, while the contents (active card, board pieces) are driven by
 * normal React state at a much lower update frequency.
 *
 * Edge handling: if the cursor sits near the right or bottom edge of the
 * viewport, the panel flips to the opposite side of the cursor so it always
 * stays in view.
 */

import { useEffect, useRef } from "react";
import { useHover } from "./hover-context";
import { AnimatedBoard } from "./AnimatedBoard";

const OFFSET_X = 22;
const OFFSET_Y = 22;
const PANEL_WIDTH_GUESS = 304; // matches the styled width below
const PANEL_HEIGHT_GUESS = 360;

export function CursorPreview() {
  const { active } = useHover();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const el = wrapRef.current;
      if (!el) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Default: bottom-right of cursor. Flip on each axis near edges.
      const flipX = e.clientX + OFFSET_X + PANEL_WIDTH_GUESS > vw - 12;
      const flipY = e.clientY + OFFSET_Y + PANEL_HEIGHT_GUESS > vh - 12;
      const x = flipX
        ? e.clientX - OFFSET_X - PANEL_WIDTH_GUESS
        : e.clientX + OFFSET_X;
      const y = flipY
        ? e.clientY - OFFSET_Y - PANEL_HEIGHT_GUESS
        : e.clientY + OFFSET_Y;
      el.style.transform = `translate(${x}px, ${y}px)`;
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="cursor-preview fixed left-0 top-0 z-50 pointer-events-none"
      style={{
        opacity: active ? 1 : 0,
        transition: "opacity 160ms cubic-bezier(0.2, 0.7, 0.2, 1)",
        willChange: "transform",
      }}
    >
      <div
        className="cursor-preview-card rounded-[3px] p-4"
        style={{
          width: PANEL_WIDTH_GUESS,
          background:
            "linear-gradient(180deg, var(--background) 0%, var(--bg-soft) 100%)",
          boxShadow:
            "0 24px 48px -16px rgba(0,0,0,0.45), 0 6px 12px -6px rgba(0,0,0,0.22), inset 1px 0 0 rgba(255,255,255,0.4)",
          borderTop: "1px solid var(--rule-soft)",
          borderRight: "1px solid var(--rule-soft)",
          borderBottom: "1px solid var(--rule-soft)",
          borderLeft: "1px solid var(--oxblood)",
        }}
      >
        <p
          className="font-mono uppercase tracking-[0.22em] text-[10px] mb-3"
          style={{ color: "var(--oxblood)", minHeight: 14 }}
        >
          {active?.eyebrow ?? ""}
        </p>
        {/* AnimatedBoard renders even before any card is active — once it
            mounts it tracks subsequent FENs, so the first card hover has
            something to tween *from* (the starting position by default).
            Orientation is forced to white-bottom regardless of the viewer's
            side in the underlying game: flipping mid-hover would force every
            piece to teleport across the board (a black rook becomes a white
            rook visually), which defeats the cross-FEN tween. */}
        <AnimatedBoard
          fen={
            active?.fen ??
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
          }
          orientation={null}
          size={32}
        />
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <span
            className="font-display italic text-sm text-foreground truncate"
            style={{ maxWidth: "70%" }}
          >
            {active?.caption ?? ""}
          </span>
          {active?.plyLabel && (
            <span className="font-mono text-[10px] text-ink-faint tracking-[0.14em] tabular-nums">
              {active.plyLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
