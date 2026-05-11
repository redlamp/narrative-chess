"use client";

/**
 * A single game rendered as a "book" — editorial card with gilt rules, an
 * eyebrow line, a display title (the opponent or open-challenge headline), and
 * a footer of metadata. Hover on the card publishes the card's FEN +
 * metadata to the hover context; a single floating <CursorPreview> at the
 * library root renders the preview pinned to the cursor.
 *
 * Open-invitation cards opt out of the preview entirely (every invite is the
 * starting position; the board adds nothing). Instead, those cards render an
 * inline coloured pawn beside the inviter's name so a player browsing the
 * shelf can read at a glance which side they'd be taking.
 *
 * Two variants:
 *   - `feature`: large card for in-progress games. Generous padding, big
 *     opponent title in Fraunces, full metadata footer.
 *   - `compact`: shorter card for archived games and open invitations.
 */

import Link from "next/link";
import { formatTimeControlLabel } from "@/lib/chess/time-controls";
import { useHover } from "./hover-context";
import { ColorPawn } from "./ColorPawn";

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
  try {
    const d = new Date(iso);
    const month = d.toLocaleString("en-US", { month: "short" });
    return `${month} ${romanize(d.getDate())} · ${romanize(d.getFullYear())}`;
  } catch {
    return "";
  }
}

function statusHeadline(
  row: GameRow,
  viewerIsWhite: boolean,
  viewerIsBlack: boolean,
): {
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
      return {
        eyebrow: `${active === "white" ? "White" : "Black"} to move`,
        oxbloodEyebrow: false,
      };
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

/**
 * Which side is the inviter playing on an open-invitation card?
 * Returns null if both sides are still null (shouldn't happen) or both are
 * set (also shouldn't happen for status='open').
 */
function inviterColor(row: GameRow): "w" | "b" | null {
  if (row.white_id && !row.black_id) return "w";
  if (row.black_id && !row.white_id) return "b";
  return null;
}

export function GameBook({ row, viewer, variant, index }: Props) {
  const { setActive, clear } = useHover();

  const viewerIsWhite = row.white_id === viewer;
  const viewerIsBlack = row.black_id === viewer;
  const youColor: "white" | "black" | null = viewerIsWhite
    ? "white"
    : viewerIsBlack
      ? "black"
      : null;

  const { eyebrow, oxbloodEyebrow } = statusHeadline(
    row,
    viewerIsWhite,
    viewerIsBlack,
  );
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
  const inviterC = isOpenInvite ? inviterColor(row) : null;

  // Archive cards (completed games) decorate BOTH names with a piece icon:
  // pawn next to the loser's name, king next to the winner. Draws and aborted
  // games — no winner — show pawns on both. Computes the colour each line
  // represents based on viewer perspective so the icons line up with the
  // names actually rendered.
  const isArchive = ["white_won", "black_won", "draw", "aborted"].includes(
    row.status,
  );
  const winnerSide: "w" | "b" | null =
    row.status === "white_won"
      ? "w"
      : row.status === "black_won"
        ? "b"
        : null;
  // Per-line colours. For viewer-on-a-side, lineA = viewer's side. For
  // observer/non-participant, lineA = white player.
  const lineAColor: "w" | "b" = youColor
    ? youColor === "white"
      ? "w"
      : "b"
    : "w";
  const lineBColor: "w" | "b" = lineAColor === "w" ? "b" : "w";
  const lineAPieceType: "p" | "k" =
    isArchive && lineAColor === winnerSide ? "k" : "p";
  const lineBPieceType: "p" | "k" =
    isArchive && lineBColor === winnerSide ? "k" : "p";

  // Pre-compute caption + plyLabel for the hover preview.
  const previewCaption = (() => {
    if (row.status === "in_progress") {
      if (youColor) {
        return `you · ${youColor === "white" ? row.black_name ?? "—" : row.white_name ?? "—"}`;
      }
      return `${row.white_name ?? "—"} · ${row.black_name ?? "—"}`;
    }
    if (row.status === "white_won" || row.status === "black_won") {
      return `${row.white_name ?? "white"} · ${row.black_name ?? "black"}`;
    }
    if (row.status === "draw") return "drawn";
    if (row.status === "aborted") return "abandoned";
    return "";
  })();

  const previewEyebrow = (() => {
    if (row.status === "in_progress") {
      return `${activeColorFromFen(row.current_fen) === "white" ? "White" : "Black"} to move`;
    }
    if (row.status === "white_won") return "White victorious";
    if (row.status === "black_won") return "Black victorious";
    if (row.status === "draw") return "Drawn";
    if (row.status === "aborted") return "Abandoned";
    return "Position";
  })();

  // Open-invite cards do not trigger the hover preview (all starting position;
  // useful info is the inviter's side, conveyed by the ColorPawn).
  const handlersForPreview = isOpenInvite
    ? {}
    : {
        onMouseEnter: () =>
          setActive({
            id: row.id,
            fen: row.current_fen,
            orientation: youColor,
            eyebrow: previewEyebrow,
            caption: previewCaption,
            plyLabel: row.ply > 0 ? `ply ${row.ply}` : null,
          }),
        onMouseLeave: clear,
        onFocus: () =>
          setActive({
            id: row.id,
            fen: row.current_fen,
            orientation: youColor,
            eyebrow: previewEyebrow,
            caption: previewCaption,
            plyLabel: row.ply > 0 ? `ply ${row.ply}` : null,
          }),
        onBlur: clear,
      };

  return (
    <Link
      href={`/games/${row.id}`}
      {...handlersForPreview}
      className={`book-card relative block ${isFeature ? "book-card--feature" : "book-card--compact"}`}
      data-variant={variant}
    >
      {/* Card composition is two layers stacked: a full-bleed oxblood
          leather cover (.book-cover) and a slightly inset parchment page
          (.book-page) that holds the actual content. The cover shows as a
          uniform red frame around the page on all four sides — the book
          aesthetic without losing the editorial cream face. */}
      <article
        className="book-cover relative h-full rounded-[4px] overflow-hidden"
        style={{
          boxShadow:
            "0 1px 0 rgba(0,0,0,0.18) inset, 0 -1px 0 rgba(0,0,0,0.30) inset, 0 10px 22px -12px rgba(0,0,0,0.45), 0 2px 4px -2px rgba(0,0,0,0.20)",
        }}
      >
        {/* Gilt corner rules sit on the OXBLOOD frame, just inside the cover
            edge, so they read as brass corner stamps on the leather. */}
        <span
          aria-hidden
          className="absolute top-[6px] left-[6px] w-5 h-5 pointer-events-none"
          style={{
            borderTop: "1.5px solid var(--book-gilt)",
            borderLeft: "1.5px solid var(--book-gilt)",
            opacity: 0.85,
          }}
        />
        <span
          aria-hidden
          className="absolute bottom-[6px] right-[6px] w-5 h-5 pointer-events-none"
          style={{
            borderBottom: "1.5px solid var(--book-gilt)",
            borderRight: "1.5px solid var(--book-gilt)",
            opacity: 0.6,
          }}
        />

        <div
          className={`book-page relative ${isFeature ? "p-7" : "p-5"} flex flex-col h-full rounded-[2px]`}
          style={{
            background:
              "linear-gradient(160deg, var(--background) 0%, var(--bg-soft) 100%)",
            margin: "14px",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.5) inset, 0 -1px 0 rgba(0,0,0,0.06) inset, 0 2px 4px -2px rgba(0,0,0,0.18)",
          }}
        >
          {/* Top decorative rule */}
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

          {/* Eyebrow */}
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

          {/* Title — opponent block. Piece icons appear on open invitations
              (pawn marking inviter's side) and on archive cards (pawn for
              loser / king for winner). */}
          <div className={`${isFeature ? "mt-3 mb-6" : "mt-2 mb-4"}`}>
            <p
              className={`font-display ${isFeature ? "text-3xl" : "text-xl"} leading-[1.05] text-foreground tracking-tight flex items-center gap-2`}
            >
              {isOpenInvite && inviterC && (
                <ColorPawn color={inviterC} size={isFeature ? 28 : 22} />
              )}
              {isArchive && (
                <ColorPawn
                  color={lineAColor}
                  type={lineAPieceType}
                  size={isFeature ? 28 : 22}
                />
              )}
              <span className="truncate">{titleLineA}</span>
            </p>
            <p
              className={`font-display italic ${isFeature ? "text-xl mt-0.5" : "text-base mt-0.5"} text-ink-soft flex items-baseline gap-2`}
            >
              {isOpenInvite && (viewerIsWhite || viewerIsBlack)
                ? ""
                : "vs."}{" "}
              {isArchive && (
                <ColorPawn
                  color={lineBColor}
                  type={lineBPieceType}
                  size={isFeature ? 24 : 20}
                  className="self-center"
                />
              )}
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
    </Link>
  );
}
