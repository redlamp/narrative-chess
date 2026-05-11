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
    setActiveState(c);
  }, []);

  const clear = useCallback(() => {
    if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    clearTimeoutRef.current = setTimeout(() => {
      setActiveState(null);
      clearTimeoutRef.current = null;
    }, 80);
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
