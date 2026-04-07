import type { ChangeEvent } from "react";
import type { ReferenceGame } from "@narrative-chess/content-schema";
import type { SavedMatchRecord } from "@/savedMatches";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { FolderOpen, Trash2 } from "lucide-react";
import { WorkspaceListItem } from "./WorkspaceListItem";

type RecentGamesPanelProps = {
  savedMatches: SavedMatchRecord[];
  selectedSavedMatchId: string | null;
  onSelectSavedMatch: (id: string) => void;
  onLoadSavedMatch: () => void;
  onDeleteSelectedSavedMatch: () => void;

  referenceGames: ReferenceGame[];
  selectedReferenceGameId: string;
  onSelectReferenceGame: (value: string) => void;
  onLoadReferenceGame: () => void;
};

export function RecentGamesPanel({
  savedMatches,
  selectedSavedMatchId,
  onSelectSavedMatch,
  onLoadSavedMatch,
  onDeleteSelectedSavedMatch,

  referenceGames,
  selectedReferenceGameId,
  onSelectReferenceGame,
  onLoadReferenceGame
}: RecentGamesPanelProps) {
  const selectedSavedMatch = savedMatches.find((m) => m.id === selectedSavedMatchId);
  const selectedReferenceGame = referenceGames.find((g) => g.id === selectedReferenceGameId);

  const handleReferenceGameSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onSelectReferenceGame(event.currentTarget.value);
  };

  const formatSavedAt = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <Tabs defaultValue="historic" className="recent-games-panel w-full">
      <TabsList className="recent-games-tabs">
        <TabsTrigger value="historic">Historic Games</TabsTrigger>
        <TabsTrigger value="saved">Your Games ({savedMatches.length})</TabsTrigger>
      </TabsList>

      {/* Historic Games Tab */}
      <TabsContent value="historic" className="recent-games-content">
        <div className="recent-games-historic">
          {/* Game Selector */}
          <div className="recent-games-selector">
            <select
              id="reference-game-select"
              className="field-select"
              value={selectedReferenceGameId}
              onChange={handleReferenceGameSelectChange}
            >
              {referenceGames.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.title} ({game.white} vs {game.black})
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={onLoadReferenceGame}>
              Load
            </Button>
          </div>

          {/* Game Details */}
          {selectedReferenceGame ? (
            <div className="recent-games-details">
              <h4>{selectedReferenceGame.title}</h4>
              <p className="muted">
                {selectedReferenceGame.white} vs {selectedReferenceGame.black}, {selectedReferenceGame.event},{" "}
                {selectedReferenceGame.year}
              </p>
              {selectedReferenceGame.site ? <p className="muted">📍 {selectedReferenceGame.site}</p> : null}
              <p className="recent-games-summary">{selectedReferenceGame.summary}</p>
              {selectedReferenceGame.sourceUrl ? (
                <p className="recent-games-link">
                  <a href={selectedReferenceGame.sourceUrl} target="_blank" rel="noreferrer">
                    Reference →
                  </a>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </TabsContent>

      {/* Saved Games Tab */}
      <TabsContent value="saved" className="recent-games-content">
        {savedMatches.length ? (
          <div className="recent-games-shell">
            <div className="recent-games-list" role="listbox" aria-label="Saved games">
              {savedMatches.map((savedMatch) => (
                <WorkspaceListItem
                  key={savedMatch.id}
                  type="button"
                  selected={savedMatch.id === selectedSavedMatchId}
                  className="recent-games-list__item"
                  onClick={() => onSelectSavedMatch(savedMatch.id)}
                  title={savedMatch.name}
                  description={formatSavedAt(savedMatch.savedAt)}
                  meta={<span className="recent-games__meta">{savedMatch.moveCount} moves</span>}
                />
              ))}
            </div>
            <div className="recent-games-actions">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-sm"
                    disabled={!selectedSavedMatch}
                    aria-label={
                      selectedSavedMatch
                        ? `Delete saved game ${selectedSavedMatch.name}`
                        : "Delete selected saved game"
                    }
                  >
                    <Trash2 />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete saved game?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {selectedSavedMatch
                        ? `This will permanently remove ${selectedSavedMatch.name} from local saved games.`
                        : "This will permanently remove the selected saved game."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={onDeleteSelectedSavedMatch}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={!selectedSavedMatch}
                onClick={onLoadSavedMatch}
                aria-label={
                  selectedSavedMatch
                    ? `Load saved game ${selectedSavedMatch.name}`
                    : "Load selected saved game"
                }
              >
                <FolderOpen />
              </Button>
            </div>
          </div>
        ) : (
          <p className="muted">No saved games yet. Save the current local game to keep your place.</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
