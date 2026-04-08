import type {
  CharacterSummary,
  NarrativeEvent,
  PieceState,
  Square,
  MoveRecord
} from "@narrative-chess/content-schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPieceDisplayName, getPieceKindLabel } from "../chessPresentation";
import { PieceArt } from "./PieceArt";

type CharacterDetailPanelProps = {
  focusedSquare: Square | null;
  focusedPiece: PieceState | null;
  focusedCharacter: CharacterSummary | null;
  focusedCharacterMoments: NarrativeEvent[];
  moveHistory: MoveRecord[];
  showRecentCharacterActions: boolean;
};

export function CharacterDetailPanel({
  focusedSquare,
  focusedPiece,
  focusedCharacter,
  focusedCharacterMoments,
  moveHistory,
  showRecentCharacterActions
}: CharacterDetailPanelProps) {
  const hasCharacter = Boolean(focusedCharacter && focusedPiece);

  const movesByNumber = new Map(moveHistory.map((move) => [move.moveNumber, move]));

  const momentsWithSan = focusedCharacterMoments.map((event) => {
    const move = movesByNumber.get(event.moveNumber);
    return {
      event,
      move,
      san: move?.san ?? "?"
    };
  });

  const characterContent = (
    <div className="character-detail-shell">
      <Tabs defaultValue="details" className="character-tabs">
        <TabsList className="character-tabs-list">
          <TabsTrigger value="details">Details</TabsTrigger>
          {showRecentCharacterActions ? (
            <TabsTrigger value="recent">Recent Actions ({focusedCharacterMoments.length})</TabsTrigger>
          ) : null}
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="character-tabs-content">
          {hasCharacter ? (
            <div className="character-detail-container">
              <div className="piece-badge">
                <span className={`piece-badge__icon piece-badge__icon--${focusedPiece!.side}`}>
                  <PieceArt
                    side={focusedPiece!.side}
                    kind={focusedPiece!.kind}
                    className="board-piece-art board-piece-art--badge"
                  />
                </span>
                <div>
                  <p className="piece-badge__label">{getPieceDisplayName(focusedPiece!)}</p>
                  <p className="muted">{getPieceKindLabel(focusedPiece!.kind)} piece</p>
                </div>
              </div>
              <h3 className="character-detail-container__name">{focusedCharacter!.fullName}</h3>
              <p className="detail-card__description character-detail-container__summary">
                {focusedCharacter!.oneLineDescription}
              </p>
              <dl className="detail-grid">
                <div>
                  <dt>Role</dt>
                  <dd>{focusedCharacter!.role}</dd>
                </div>
                <div>
                  <dt>Origin</dt>
                  <dd>{focusedCharacter!.districtOfOrigin}</dd>
                </div>
                <div>
                  <dt>Faction</dt>
                  <dd>{focusedCharacter!.faction}</dd>
                </div>
                <div>
                  <dt>Square</dt>
                  <dd>{focusedSquare ?? "None"}</dd>
                </div>
              </dl>
              {focusedCharacter!.traits.length > 0 && (
                <div className="character-detail-container__chip-group">
                  <p className="field-label">Traits</p>
                  <div className="chip-row">
                    {focusedCharacter!.traits.map((trait) => (
                      <span key={trait} className="chip">
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {focusedCharacter!.verbs.length > 0 && (
                <div className="character-detail-container__chip-group">
                  <p className="field-label">Actions</p>
                  <div className="chip-row">
                    {focusedCharacter!.verbs.map((verb) => (
                      <span key={verb} className="chip">
                        {verb}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="character-detail-container character-detail-container--empty">
              <div className="piece-badge">
                <div>
                  <p className="piece-badge__label">Piece</p>
                </div>
              </div>
              <h3 className="character-detail-container__name">Character</h3>
              <div
                className="story-empty-state__spacer story-empty-state__spacer--description"
                aria-hidden="true"
              />
              <dl className="detail-grid">
                <div>
                  <dt>Role</dt>
                  <dd>
                    <span
                      className="story-empty-state__spacer story-empty-state__spacer--detail-line"
                      aria-hidden="true"
                    />
                  </dd>
                </div>
                <div>
                  <dt>Origin</dt>
                  <dd>
                    <span
                      className="story-empty-state__spacer story-empty-state__spacer--detail-line"
                      aria-hidden="true"
                    />
                  </dd>
                </div>
                <div>
                  <dt>Faction</dt>
                  <dd>
                    <span
                      className="story-empty-state__spacer story-empty-state__spacer--detail-line"
                      aria-hidden="true"
                    />
                  </dd>
                </div>
                <div>
                  <dt>Square</dt>
                  <dd>
                    <span
                      className="story-empty-state__spacer story-empty-state__spacer--detail-line"
                      aria-hidden="true"
                    />
                  </dd>
                </div>
              </dl>
              <div className="character-detail-container__chip-group">
                <p className="field-label">Traits</p>
                <div className="story-empty-state__spacer story-empty-state__spacer--group" aria-hidden="true" />
              </div>
              <div className="character-detail-container__chip-group">
                <p className="field-label">Actions</p>
                <div className="story-empty-state__spacer story-empty-state__spacer--group" aria-hidden="true" />
              </div>
            </div>
          )}
        </TabsContent>

        {/* Recent Actions Tab */}
        {showRecentCharacterActions ? (
          <TabsContent value="recent" className="character-tabs-content">
            <div className="character-recent-actions">
              {!hasCharacter ? (
                <p className="muted">No character selected.</p>
              ) : momentsWithSan.length > 0 ? (
                momentsWithSan.map(({ event, san }) => (
                  <article key={event.id} className="character-action-item">
                    <div className="character-action-header">
                      <span className="character-action-move">
                        <strong>{san}</strong> <span className="muted">Move {event.moveNumber}</span>
                      </span>
                      <span className="character-action-type">{event.eventType}</span>
                    </div>
                    <p className="character-action-headline">{event.headline}</p>
                    {event.detail && <p className="character-action-detail">{event.detail}</p>}
                  </article>
                ))
              ) : (
                <p className="muted">No moves this game yet.</p>
              )}
            </div>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );

  return characterContent;
}
