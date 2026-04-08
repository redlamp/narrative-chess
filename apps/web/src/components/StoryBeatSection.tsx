import type { MoveRecord, NarrativeEvent } from "@narrative-chess/content-schema";

type StoryBeatSectionProps = {
  selectedMove: MoveRecord | null;
  selectedEvent: NarrativeEvent | null;
  showLabel?: boolean;
};

export function StoryBeatSection({
  selectedMove,
  selectedEvent,
  showLabel = true
}: StoryBeatSectionProps) {
  const hasMove = Boolean(selectedMove);
  const move = selectedMove;

  return (
    <section className="story-section story-section--beat story-section--stable">
      {showLabel ? <p className="field-label">Story Beat</p> : null}
      {hasMove ? (
        selectedEvent ? (
          <>
            <div className="detail-card__title-row story-section__title-row">
              <h3 className="story-section__title">{selectedEvent.headline}</h3>
              <span className="side-pill side-pill--compact">Move {move!.moveNumber}</span>
            </div>
            <p className="detail-card__description story-section__description">
              {selectedEvent.detail}
            </p>
            <p className="timeline__link story-section__meta">
              Board action: {move!.san} on {selectedEvent.location}
            </p>
          </>
        ) : (
          <>
            <div className="detail-card__title-row story-section__title-row">
              <h3 className="story-section__title">{move!.san}</h3>
              <span className="side-pill side-pill--compact">Move {move!.moveNumber}</span>
            </div>
            <p className="detail-card__description story-section__description">
              This move does not have a generated story beat yet.
            </p>
          </>
        )
      ) : (
        <div className="story-empty-state story-empty-state--beat">
          <div className="detail-card__title-row story-section__title-row">
            <h3 className="story-section__title">Headline</h3>
          </div>
          <div
            className="story-empty-state__spacer story-empty-state__spacer--description"
            aria-hidden="true"
          />
          <p className="timeline__link story-section__meta">
            <span className="content-outline__section-label">Board action:</span>
          </p>
        </div>
      )}
    </section>
  );
}
