import type { ReactNode } from "react";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";
import type { MoveRecord } from "@narrative-chess/content-schema";
import { Button } from "@/components/ui/button";
import { Panel } from "./Panel";

type MatchHistoryPanelProps = {
  moves: MoveRecord[];
  selectedPly: number;
  totalPlies: number;
  canUndo: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onJumpToStart: () => void;
  onStepBackward: () => void;
  onStepForward: () => void;
  onJumpToEnd: () => void;
  onSelectPly: (ply: number) => void;
  onUndo: () => void;
  headerAction?: ReactNode;
};

type MovePair = {
  moveNumber: number;
  white: MoveRecord;
  black: MoveRecord | null;
};

function buildMovePairs(moves: MoveRecord[]): MovePair[] {
  const pairs: MovePair[] = [];

  for (let index = 0; index < moves.length; index += 2) {
    const white = moves[index];
    if (!white) {
      continue;
    }

    pairs.push({
      moveNumber: Math.floor(index / 2) + 1,
      white,
      black: moves[index + 1] ?? null
    });
  }

  return pairs;
}

export function MatchHistoryPanel({
  moves,
  selectedPly,
  totalPlies,
  canUndo,
  collapsed,
  onToggleCollapse,
  onJumpToStart,
  onStepBackward,
  onStepForward,
  onJumpToEnd,
  onSelectPly,
  onUndo,
  headerAction
}: MatchHistoryPanelProps) {
  const movePairs = buildMovePairs(moves);
  const selectedMove = selectedPly > 0 ? moves[selectedPly - 1] ?? null : null;

  return (
    <Panel
      title="Match History (PGN)"
      eyebrow="History"
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      action={
        <div className="panel-toolbar">
          <div className="match-history__nav">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={onJumpToStart}
              disabled={selectedPly === 0}
              aria-label="Jump to the start position"
            >
              <ChevronFirst />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={onStepBackward}
              disabled={selectedPly === 0}
              aria-label="Step backward one move"
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={onStepForward}
              disabled={selectedPly >= totalPlies}
              aria-label="Step forward one move"
            >
              <ChevronRight />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={onJumpToEnd}
              disabled={selectedPly >= totalPlies}
              aria-label="Jump to the latest position"
            >
              <ChevronLast />
            </Button>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onUndo} disabled={!canUndo}>
            Undo
          </Button>
          {headerAction}
        </div>
      }
    >
      <div className="match-history">
        <div className="match-history__summary">
          <p className="muted">
            {selectedMove
              ? `Showing the board after ${selectedMove.moveNumber}. ${selectedMove.san}.`
              : "Showing the starting position before move 1."}
          </p>
          <span className="side-pill">{selectedMove ? `Ply ${selectedPly}` : "Start"}</span>
        </div>

        {movePairs.length ? (
          <div className="match-history__score">
            {movePairs.map((movePair) => (
              <article key={movePair.moveNumber} className="match-history__row">
                <span className="match-history__move-number">{movePair.moveNumber}.</span>
                <button
                  type="button"
                  className={[
                    "match-history__move-button",
                    selectedPly === movePair.white.moveNumber ? "match-history__move-button--active" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-current={selectedPly === movePair.white.moveNumber ? "step" : undefined}
                  onClick={() => onSelectPly(movePair.white.moveNumber)}
                >
                  <span className="match-history__move-side">White</span>
                  <span>{movePair.white.san}</span>
                </button>
                {movePair.black ? (
                  <button
                    type="button"
                    className={[
                      "match-history__move-button",
                      selectedPly === movePair.black.moveNumber ? "match-history__move-button--active" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-current={selectedPly === movePair.black.moveNumber ? "step" : undefined}
                    onClick={() => onSelectPly(movePair.black?.moveNumber ?? movePair.white.moveNumber)}
                  >
                    <span className="match-history__move-side">Black</span>
                    <span>{movePair.black.san}</span>
                  </button>
                ) : (
                  <span className="match-history__move-empty">...</span>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">The PGN log will appear here as soon as the first move lands.</p>
        )}
      </div>
    </Panel>
  );
}
