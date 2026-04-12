import type { ReferenceGame } from "@narrative-chess/content-schema";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { Panel } from "./Panel";

type StudySession = {
  title: string;
  subtitle: string;
  summary: string;
  sourceUrl: string | null;
  currentPly: number;
  totalPlies: number;
};

type StudyPanelProps = {
  referenceGames: ReferenceGame[];
  selectedReferenceGameId: string;
  onSelectReferenceGame: (value: string) => void;
  onLoadReferenceGame: () => void;
  studySession: StudySession | null;
  canStepBackward: boolean;
  canStepForward: boolean;
  onJumpToStart: () => void;
  onStepBackward: () => void;
  onStepForward: () => void;
  onJumpToEnd: () => void;
  onExitStudy: () => void;
  embedded?: boolean;
};

export function StudyPanel({
  referenceGames,
  selectedReferenceGameId,
  onSelectReferenceGame,
  onLoadReferenceGame,
  studySession,
  canStepBackward,
  canStepForward,
  onJumpToStart,
  onStepBackward,
  onStepForward,
  onJumpToEnd,
  onExitStudy,
  embedded = false
}: StudyPanelProps) {
  const selectedGame = referenceGames.find((g) => g.id === selectedReferenceGameId);
  const currentLabel = selectedGame
    ? `${selectedGame.title} (${selectedGame.white} vs ${selectedGame.black})`
    : "Select a game";

  const content = (
    <div className="study-panel">
      <div className="study-panel__block">
        <div className="study-panel__row">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="field-select" id="reference-game-select">
                {currentLabel} <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup value={selectedReferenceGameId} onValueChange={onSelectReferenceGame}>
                {referenceGames.map((game) => (
                  <DropdownMenuRadioItem key={game.id} value={game.id}>
                    {game.title} ({game.white} vs {game.black})
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" variant="outline" size="sm" onClick={onLoadReferenceGame}>
            Load
          </Button>
        </div>
      </div>

      {studySession ? (
        <div className="study-panel__block study-panel__block--session">
          <div className="study-panel__session-header">
            <div>
              <p className="section-eyebrow">Current study</p>
              <h3>{studySession.title}</h3>
              <p className="muted">{studySession.subtitle}</p>
            </div>
            <span className="side-pill side-pill--white">
              Ply {studySession.currentPly} / {studySession.totalPlies}
            </span>
          </div>
          <p className="study-panel__summary">{studySession.summary}</p>
          {studySession.sourceUrl ? (
            <p className="study-panel__source">
              <a href={studySession.sourceUrl} target="_blank" rel="noreferrer">
                Historical reference
              </a>
            </p>
          ) : null}
          <div className="study-panel__actions">
            <Button type="button" variant="outline" size="sm" onClick={onJumpToStart} disabled={!canStepBackward}>
              Start
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onStepBackward} disabled={!canStepBackward}>
              Prev
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onStepForward} disabled={!canStepForward}>
              Next
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onJumpToEnd} disabled={!canStepForward}>
              End
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onExitStudy}>
              Resume local game
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Panel title="Historic Games">
      {content}
    </Panel>
  );
}
