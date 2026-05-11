"use client";

/**
 * A single game rendered as a "book" — editorial card with gilt rules, an
 * eyebrow line, a display title (the opponent or open-challenge headline), and
 * a footer of metadata. Hover lifts the card and slides a "page" out from the
 * right edge holding a MiniBoard preview of the current FEN.
 *
 * Two variants:
 *   - `feature`: large card for in-progress games. Generous padding, big
 *     opponent title in Fraunces, full metadata footer.
 *   - `compact`: shorter card for open challenges and archived games.
 *
 * The hover preview is rendered conditionally (only when the card has been
 * hovered at least once) so unhovered cards don't pay the cost of mounting a
 * MiniBoard. Once mounted, opacity/translate is driven by CSS hover state for
 * cheap re-show on subsequent hovers.
 */

import Link from "next/link";
import { useState } from "react";
import { HoverPreview } from "./HoverPreview";
import { formatTimeControlLabel } from "@/lib/chess/time-controls";

export type GameRow = {
  id: string;
  status: string;
  ply: number;
  white_id: string | null;
  black_id: string | null;
  created_at: string;
  current_fen: string;
  termination_reason: string | null;
  white_name: string | null;
  black_name: string | null;
  time_control_type: string | null;
  time_initial_seconds: number | null;
  time_increment_seconds: number | null;
  time_per_move_seconds: number | null;
};

type Variant = "feature" | "compact";

type Props = {
  row: GameRow;
  viewer: string;
  variant: Variant;
  /** 1-based index within section — drives the volume roman numeral. */
  index: number;
};

function romanize(n: number): string {
  if (n <= 0) return "";
  const map: ReadonlyArray<readonly [number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  let rem = n;
  for (const [v, s] of map) {
    while (rem >= v) {
      out += s;
      rem -= v;
    }
  }
  return out;
}

function activeColorFromFen(fen: string): "white" | "black" {
  const parts = fen.split(/\s+/);
  return parts[1] === "b" ? "black" : "white";
}

function formatEditorialDate(iso: string): string {
  // "May XI · MMXXVI" — editorial-ish flourish; falls back gracefully if the
  // date is undefined.
  try {
    const d = new Date(iso);
    const month = d.toLocaleString("en-US", { month: "short" });
    return `${month} ${romanize(d.getDate())} · ${romanize(d.getFullYear())}`;
  } catch {
    return "";
  }
}

function statusHeadline(row: GameRow, viewerIsWhite: boolean, viewerIsBlack: boolean): {
  eyebrow: string;
  oxbloodEyebrow: boolean;
} {
  switch (row.status) {
    case "in_progress": {
      const active = activeColorFromFen(row.current_fen);
      const yourTurn =
        (viewerIsWhite && active === "white") ||
        (viewerIsBlack && active === "black");
      if (yourTurn) return { eyebrow: "Your move", oxbloodEyebrow: true };
      if (viewerIsWhite || viewerIsBlack)
        return { eyebrow: "Awaiting reply", oxbloodEyebrow: false };
      return { eyebrow: `${active === "white" ? "White" : "Black"} to move`, oxbloodEyebrow: false };
    }
    case "open":
      if (viewerIsWhite || viewerIsBlack)
        return { eyebrow: "Awaiting challenger", oxbloodEyebrow: false };
      return { eyebrow: "Open invitation", oxbloodEyebrow: true };
    case "white_won":
      return { eyebrow: "White victorious", oxbloodEyebrow: false };
    case "black_won":
      return { eyebrow: "Black victorious", oxbloodEyebrow: false };
    case "draw":
      return { eyebrow: "Drawn", oxbloodEyebrow: false };
    case "aborted":
      return { eyebrow: "Aborted", oxbloodEyebrow: false };
    default:
      return { eyebrow: row.status, oxbloodEyebrow: false };
  }
}

function terminationFlavor(reason: string | null): string | null {
  switch (reason) {
    case "checkmate":
      return "by checkmate";
    case "resignation":
      return "by resignation";
    case "stalemate":
      return "by stalemate";
    case "draw_agreement":
      return "by agreement";
    case "timeout":
      return "by timeout";
    case "abort_pre_first_move":
    case "abort_after_first_move":
      return "abandoned";
    default:
      return null;
  }
}

export function GameBook({ row, viewer, variant, index }: Props) {
  const [hoveredOnce, setHoveredOnce] = useState(false);
  const viewerIsWhite = row.white_id === viewer;
  const viewerIsBlack = row.black_id === viewer;
  const youColor: "white" | "black" | null = viewerIsWhite
    ? "white"
    : viewerIsBlack
      ? "black"
      : null;

  const { eyebrow, oxbloodEyebrow } = statusHeadline(row, viewerIsWhite, viewerIsBlack);
  const termination = terminationFlavor(row.termination_reason);
  const tcLabel = formatTimeControlLabel(row);
  const editorialDate = formatEditorialDate(row.created_at);

  // Title resolution. Open challenges where viewer is on a side render the
  // taken side + "(seat open)" so the card reads as their unfilled invite.
  // Open challenges where viewer is *not* on a side advertise the lone player.
  const isOpenInvite = row.status === "open";
  let titleLineA: string;
  let titleLineB: string;
  if (isOpenInvite) {
    if (viewerIsWhite) {
      titleLineA = row.white_name ?? "you";
      titleLineB = "seat open";
    } else if (viewerIsBlack) {
      titleLineA = row.black_name ?? "you";
      titleLineB = "seat open";
    } else {
      const named = row.white_name ?? row.black_name ?? "anonymous";
      titleLineA = named;
      titleLineB = "seeking opponent";
    }
  } else {
    // In-progress or completed: viewer vs opponent (or both if observer)
    if (youColor) {
      const opponent = youColor === "white" ? row.black_name : row.white_name;
      titleLineA = "you";
      titleLineB = opponent ?? "—";
    } else {
      titleLineA = row.white_name ?? "—";
      titleLineB = row.black_name ?? "—";
    }
  }

  const isFeature = variant === "feature";

  return (
    <Link
      href={`/games/${row.id}`}
      onMouseEnter={() => setHoveredOnce(true)}
      onFocus={() => setHoveredOnce(true)}
      className={`book-card relative block ${isFeature ? "book-card--feature" : "book-card--compact"}`}
      data-variant={variant}
    >
      <article
        className="book-cover relative h-full rounded-[3px] overflow-visible"
        style={{
          background:
            "linear-gradient(160deg, var(--background) 0%, var(--bg-soft) 100%)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.5) inset, 0 -1px 0 rgba(0,0,0,0.04) inset, 0 8px 18px -10px rgba(0,0,0,0.30), 0 2px 4px -2px rgba(0,0,0,0.12)",
        }}
      >
        {/* Gilt corner rule — purely decorative, marks the card as a book cover */}
        <span
          aria-hidden
          className="absolute top-0 left-0 w-6 h-6 pointer-events-none"
          style={{
            borderTop: "2px solid var(--oxblood)",
            borderLeft: "2px solid var(--oxblood)",
            opacity: 0.85,
          }}
        />
        <span
          aria-hidden
          className="absolute bottom-0 right-0 w-6 h-6 pointer-events-none"
          style={{
            borderBottom: "2px solid var(--oxblood)",
            borderRight: "2px solid var(--oxblood)",
            opacity: 0.55,
          }}
        />

        <div
          className={`relative ${isFeature ? "p-7" : "p-5"} flex flex-col h-full`}
        >
          {/* Top rule + eyebrow */}
          <div className="flex items-center gap-3 mb-4">
            <span
              aria-hidden
              className="h-px flex-1"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, var(--ink-faint-border) 30%, var(--ink-faint-border) 70%, transparent 100%)",
              }}
            />
          </div>

          <p
            className={`font-mono uppercase tracking-[0.22em] ${isFeature ? "text-[11px]" : "text-[10px]"} mb-1`}
            style={{
              color: oxbloodEyebrow ? "var(--oxblood)" : "var(--ink-soft)",
            }}
          >
            <span className="opacity-70">Vol.&nbsp;</span>
            <span>{romanize(index)}</span>
            <span className="opacity-50"> · </span>
            <span>{eyebrow}</span>
          </p>

          {/* Title — opponent block */}
          <div className={`${isFeature ? "mt-3 mb-6" : "mt-2 mb-4"}`}>
            <p
              className={`font-display ${isFeature ? "text-3xl" : "text-xl"} leading-[1.05] text-foreground tracking-tight`}
            >
              {titleLineA}
            </p>
            <p
              className={`font-display italic ${isFeature ? "text-xl mt-0.5" : "text-base mt-0.5"} text-ink-soft`}
            >
              {isOpenInvite && (viewerIsWhite || viewerIsBlack)
                ? ""
                : "vs."}{" "}
              <span className="not-italic font-display text-foreground">
                {titleLineB}
              </span>
            </p>
          </div>

          {/* Footer rule + meta */}
          <div className="mt-auto">
            <span
              aria-hidden
              className="block h-px mb-3"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, var(--ink-faint-border) 30%, var(--ink-faint-border) 70%, transparent 100%)",
              }}
            />
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-mono uppercase tracking-[0.16em] text-[10px] text-ink-faint">
                {tcLabel}
                {row.status === "in_progress" && (
                  <>
                    <span className="opacity-50"> · </span>
                    <span className="tabular-nums">ply {row.ply}</span>
                  </>
                )}
                {termination && (
                  <>
                    <span className="opacity-50"> · </span>
                    <span>{termination}</span>
                  </>
                )}
              </p>
              <p className="font-mono text-[10px] text-ink-faint tracking-[0.14em]">
                {editorialDate}
              </p>
            </div>
          </div>
        </div>
      </article>

      {/* Fly-out page preview — mounts on first hover. CSS hover state on the
          parent .book-card drives opacity + translate transition. */}
      {hoveredOnce && (
        <HoverPreview
          fen={row.current_fen}
          orientation={youColor}
          eyebrow={
            row.status === "in_progress"
              ? `${activeColorFromFen(row.current_fen) === "white" ? "White" : "Black"} to move`
              : row.status === "open"
                ? "Awaiting first move"
                : "Final position"
          }
          plyLabel={row.ply > 0 ? `ply ${row.ply}` : undefined}
        />
      )}
    </Link>
  );
}
