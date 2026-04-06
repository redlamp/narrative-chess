import type {
  CharacterSummary,
  NarrativeEvent,
  PieceState,
  Square
} from "@narrative-chess/content-schema";
import { getPieceDisplayName, getPieceKindLabel } from "../chessPresentation";
import { PieceArt } from "./PieceArt";

type StoryCharacterSectionProps = {
  focusedSquare: Square | null;
  focusedPiece: PieceState | null;
  focusedCharacter: CharacterSummary | null;
  focusedCharacterMoments: NarrativeEvent[];
  showRecentCharacterActions: boolean;
};

export function StoryCharacterSection({
  focusedSquare,
  focusedPiece,
  focusedCharacter,
  focusedCharacterMoments,
  showRecentCharacterActions
}: StoryCharacterSectionProps) {
  return (
    <>
      <p className="field-label">Character</p>
      {focusedCharacter && focusedPiece ? (
        <>
          <div className="piece-badge">
            <span className={`piece-badge__icon piece-badge__icon--${focusedPiece.side}`}>
              <PieceArt
                side={focusedPiece.side}
                kind={focusedPiece.kind}
                className="board-piece-art board-piece-art--badge"
              />
            </span>
            <div>
              <p className="piece-badge__label">{getPieceDisplayName(focusedPiece)}</p>
              <p className="muted">{getPieceKindLabel(focusedPiece.kind)} piece</p>
            </div>
          </div>
          <h3>{focusedCharacter.fullName}</h3>
          <p className="detail-card__description">{focusedCharacter.oneLineDescription}</p>
          <dl className="detail-grid">
            <div>
              <dt>Role</dt>
              <dd>{focusedCharacter.role}</dd>
            </div>
            <div>
              <dt>Origin</dt>
              <dd>{focusedCharacter.districtOfOrigin}</dd>
            </div>
            <div>
              <dt>Faction</dt>
              <dd>{focusedCharacter.faction}</dd>
            </div>
            <div>
              <dt>Square</dt>
              <dd>{focusedSquare ?? "None"}</dd>
            </div>
          </dl>
          {focusedCharacter.traits.length > 0 && (
            <div>
              <p className="field-label">Traits</p>
              <div className="chip-row">
                {focusedCharacter.traits.map((trait) => (
                  <span key={trait} className="chip">
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          )}
          {focusedCharacter.verbs.length > 0 && (
            <div>
              <p className="field-label">Actions</p>
              <div className="chip-row">
                {focusedCharacter.verbs.map((verb) => (
                  <span key={verb} className="chip">
                    {verb}
                  </span>
                ))}
              </div>
            </div>
          )}
          {showRecentCharacterActions && focusedCharacterMoments.length ? (
            <div className="memory-list">
              <p className="memory-list__label">Recent actions</p>
              {focusedCharacterMoments.map((event) => (
                <article key={event.id} className="memory-item">
                  <span className="memory-item__meta">
                    Move {event.moveNumber} | {event.eventType}
                  </span>
                  <p className="memory-item__headline">{event.headline}</p>
                </article>
              ))}
            </div>
          ) : null}
        </>
      ) : focusedSquare ? (
        <p className="muted">No active piece is standing on this tile right now.</p>
      ) : (
        <p className="muted">Hover a square to inspect the piece standing there.</p>
      )}
    </>
  );
}
