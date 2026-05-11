"use client";

/**
 * Floating, fixed-positioned preview panel that follows the cursor.
 *
 * Three transform layers, all driven directly by ref.style.transform on
 * mousemove (decoupled from React state):
 *
 *   1. posRef — `translate(cursorX, cursorY)`. Pinned to the cursor with no
 *      transition, so the panel never lags behind the pointer.
 *   2. offsetRef — `translate(±OFFSET_X ± width?, ±OFFSET_Y ± height?)`.
 *      Places the card to one of four quadrants around the cursor. Only
 *      updates when the quadrant actually changes; CSS transitions tween the
 *      flip over 320ms so the panel never *pops* when it switches sides near
 *      a viewport edge.
 *   3. tiltRef — `perspective(900px) rotateX rotateY`. Subtle screen-position
 *      driven tilt: when the cursor sits at the left side of the screen the
 *      card faces slightly right, when at the bottom it tilts to face up,
 *      etc. Limits to ±5° on each axis. Instant per mousemove.
 *
 * The `active` state from the hover context controls opacity (whether the
 * panel is shown) and the card's contents (FEN, caption, eyebrow).
 */

import { useEffect, useRef } from "react";
import { useHover } from "./hover-context";
import { AnimatedBoard } from "./AnimatedBoard";

const OFFSET_X = 22;
const OFFSET_Y = 22;
const PANEL_WIDTH_GUESS = 336;
const PANEL_HEIGHT_GUESS = 408;
// Board square dimension. 38 × 8 = 304, leaving ~16px breathing inside the
// 336-wide panel after p-4 padding (32px), so the board sits centred and
// fills the frame without crowding the eyebrow + caption rows.
const BOARD_SQUARE_PX = 38;
// Tilt magnitudes tuned to read as depth without becoming a parlour trick.
// Horizontal axis is more pronounced than the vertical because eye-level
// cursor motion is mostly side-to-side; up/down tilt earns less emphasis.
const MAX_TILT_Y = 7; // ° rotation around vertical axis (cursor x → rotateY)
const MAX_TILT_X = 2.5; // ° rotation around horizontal axis (cursor y → rotateX)
const PERSPECTIVE_PX = 700;

type Quadrant = "br" | "bl" | "tr" | "tl";

function offsetFor(q: Quadrant): { x: number; y: number } {
  return {
    x: q[1] === "l" ? -OFFSET_X - PANEL_WIDTH_GUESS : OFFSET_X,
    y: q[0] === "t" ? -OFFSET_Y - PANEL_HEIGHT_GUESS : OFFSET_Y,
  };
}

export function CursorPreview() {
  const { active } = useHover();
  const posRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef<HTMLDivElement | null>(null);
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const quadrantRef = useRef<Quadrant>("br");

  useEffect(() => {
    // Seed the offset layer so the panel doesn't start at translate(0,0).
    const seed = offsetFor("br");
    if (offsetRef.current) {
      offsetRef.current.style.transform = `translate(${seed.x}px, ${seed.y}px)`;
    }

    function onMove(e: MouseEvent) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // 1. Position — instant.
      if (posRef.current) {
        posRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }

      // 2. Quadrant — animate only on flip.
      const wantFlipX =
        e.clientX + OFFSET_X + PANEL_WIDTH_GUESS > vw - 12;
      const wantFlipY =
        e.clientY + OFFSET_Y + PANEL_HEIGHT_GUESS > vh - 12;
      const next: Quadrant = `${wantFlipY ? "t" : "b"}${wantFlipX ? "l" : "r"}`;
      if (next !== quadrantRef.current) {
        quadrantRef.current = next;
        const { x, y } = offsetFor(next);
        if (offsetRef.current) {
          offsetRef.current.style.transform = `translate(${x}px, ${y}px)`;
        }
      }

      // 3. Tilt — instant. Map cursor to a 3D rotation around the panel's
      // local centre. Card faces toward the centre of the viewport: cursor at
      // left → card tilts to face right; cursor at top → card tilts down.
      // Signed curve so the magnitude grows faster near the edges (visible
      // even when the cursor is only halfway from centre).
      if (tiltRef.current) {
        const rawX = (e.clientX / vw) * 2 - 1;
        const rawY = (e.clientY / vh) * 2 - 1;
        const normX = Math.max(-1, Math.min(1, rawX));
        const normY = Math.max(-1, Math.min(1, rawY));
        // signed sqrt curve: keeps sign, accelerates magnitude
        const curveX = Math.sign(normX) * Math.sqrt(Math.abs(normX));
        const curveY = Math.sign(normY) * Math.sqrt(Math.abs(normY));
        const rotY = -curveX * MAX_TILT_Y;
        const rotX = curveY * MAX_TILT_X;
        tiltRef.current.style.transform = `perspective(${PERSPECTIVE_PX}px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      }
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={posRef}
      aria-hidden
      className="cursor-preview fixed left-0 top-0 z-50 pointer-events-none"
      style={{
        opacity: active ? 1 : 0,
        transition: "opacity 160ms cubic-bezier(0.2, 0.7, 0.2, 1)",
        willChange: "transform",
      }}
    >
      <div
        ref={offsetRef}
        className="cursor-preview-offset"
        style={{
          transition: "transform 320ms cubic-bezier(0.2, 0.7, 0.2, 1)",
          willChange: "transform",
        }}
      >
        <div
          ref={tiltRef}
          className="cursor-preview-tilt"
          style={{
            transformStyle: "preserve-3d",
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
                "0 28px 56px -18px rgba(0,0,0,0.5), 0 8px 16px -8px rgba(0,0,0,0.25), inset 1px 0 0 rgba(255,255,255,0.4)",
              borderTop: "1px solid var(--rule-soft)",
              borderRight: "1px solid var(--rule-soft)",
              borderBottom: "1px solid var(--rule-soft)",
              borderLeft: "1px solid var(--oxblood)",
              backfaceVisibility: "hidden",
            }}
          >
            <p
              className="font-mono uppercase tracking-[0.22em] text-[10px] mb-3"
              style={{ color: "var(--oxblood)", minHeight: 14 }}
            >
              {active?.eyebrow ?? ""}
            </p>
            {/* AnimatedBoard renders even before any card is active — once
                mounted it tracks subsequent FENs so the first hover has a
                position to tween *from*. Orientation pinned to white-bottom
                regardless of viewer side: flipping the board mid-hover would
                teleport every piece across (white-pieces-on-bottom becomes
                black-pieces-on-bottom) and defeat the cross-FEN tween. */}
            <AnimatedBoard
              fen={
                active?.fen ??
                "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
              }
              orientation={null}
              size={BOARD_SQUARE_PX}
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
      </div>
    </div>
  );
}
