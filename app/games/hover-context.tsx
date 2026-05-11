"use client";

/**
 * Single source of truth for the floating cursor preview on the library page.
 *
 * Each book card calls `setActive` on mouseenter and `clear` on mouseleave;
 * the cursor preview component subscribes to the active card and renders
 * itself accordingly. The "clear" path is debounced by a small grace period
 * so moving the cursor from one card to an adjacent card replaces the active
 * card directly (no null-flicker in between).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type HoverCard = {
  /** Stable id of the source game — used to dedupe rapid re-enters. */
  id: string;
  fen: string;
  orientation: "white" | "black" | null;
  /** Short editorial line above the board, e.g. "White to move" / "Final position". */
  eyebrow: string;
  /** Bottom caption — opponent names or game subtitle. */
  caption: string;
  /** ply label, e.g. "ply 23" or null for open invites (which won't trigger preview). */
  plyLabel: string | null;
};

type Ctx = {
  active: HoverCard | null;
  setActive: (c: HoverCard) => void;
  clear: () => void;
};

const HoverContext = createContext<Ctx | null>(null);

export function HoverProvider({ children }: { children: React.ReactNode }) {
  const [active, setActiveState] = useState<HoverCard | null>(null);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setActive = useCallback((c: HoverCard) => {
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
    // Skip the state update when the same card is re-hovered — avoids
    // unnecessary re-renders of the preview while the cursor moves within
    // a single card.
    setActiveState((curr) => (curr && curr.id === c.id ? curr : c));
  }, []);

  const clear = useCallback(() => {
    if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    // Long-ish debounce (220ms) so the cursor crossing the gap between two
    // cards in the grid (~20px gap at typical cursor speed = 60–120ms travel)
    // never lets the preview blink off in between. A new card's mouseenter
    // cancels this timeout, so flicker is impossible as long as the cursor
    // lands on the next card within the window.
    clearTimeoutRef.current = setTimeout(() => {
      setActiveState(null);
      clearTimeoutRef.current = null;
    }, 220);
  }, []);

  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    };
  }, []);

  const value = useMemo<Ctx>(() => ({ active, setActive, clear }), [active, setActive, clear]);

  return <HoverContext.Provider value={value}>{children}</HoverContext.Provider>;
}

export function useHover(): Ctx {
  const ctx = useContext(HoverContext);
  if (!ctx) throw new Error("useHover must be used inside <HoverProvider>");
  return ctx;
}
