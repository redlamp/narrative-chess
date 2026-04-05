import type { MoveRecord, NarrativeEvent } from "@narrative-chess/content-schema";

type StoryBeatSectionProps = {
  selectedMove: MoveRecord | null;
  selectedEvent: NarrativeEvent | null;
};

export function StoryBeatSection({
  selectedMove,
  selectedEvent
}: StoryBeatSectionProps) {
  return (
    <>
      <p className="field-label">Story Beat</p>
      {selectedMove ? (
        selectedEvent ? (
          <>
            <div className="detail-card__title-row">
              <h3>{selectedEvent.headline}</h3>
              <span className="side-pill">Move {selectedMove.moveNumber}</span>
            </div>
            <p className="detail-card__description">{selectedEvent.detail}</p>
            <p className="timeline__link">
              Board action: {selectedMove.san} on {selectedEvent.location}
            </p>
          </>
        ) : (
          <>
            <div className="detail-card__title-row">
              <h3>{selectedMove.san}</h3>
              <span className="side-pill">Move {selectedMove.moveNumber}</span>
            </div>
            <p className="detail-card__description">
              This move does not have a generated story beat yet.
            </p>
          </>
        )
      ) : (
        <p className="muted">Select a move in the PGN log to read the matching story beat.</p>
      )}
    </>
  );
}
