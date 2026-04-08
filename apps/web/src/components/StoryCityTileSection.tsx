import type { CharacterSummary, DistrictCell, PieceState } from "@narrative-chess/content-schema";
import { PieceArt } from "./PieceArt";

type StoryCityTileSectionProps = {
  focusedDistrict: DistrictCell | null;
  focusedPiece: PieceState | null;
  focusedCharacter: CharacterSummary | null;
  showLabel?: boolean;
};

export function StoryCityTileSection({
  focusedDistrict,
  focusedPiece,
  focusedCharacter,
  showLabel = true
}: StoryCityTileSectionProps) {
  return (
    <section className="story-section story-section--city story-section--stable">
      {showLabel ? <p className="field-label">City Tile</p> : null}
      {focusedDistrict ? (
        <>
          <div className="detail-card__title-row story-section__title-row">
            <h3 className="story-section__title story-city__title city-map-panel__title">
              {focusedDistrict.name}
            </h3>
            <span className="side-pill side-pill--compact side-pill--white">{focusedDistrict.square}</span>
          </div>
          <p className="detail-card__description story-section__description">
            {focusedDistrict.locality} | {focusedDistrict.dayProfile}
          </p>
          <div className="story-city__groups">
            <div className="story-city__group">
              <p className="field-label">Descriptors</p>
              <div className="chip-row">
                {focusedDistrict.descriptors.map((descriptor) => (
                  <span key={descriptor} className="chip">
                    {descriptor}
                  </span>
                ))}
              </div>
            </div>
            <div className="story-city__group">
              <p className="field-label">Landmarks</p>
              <div className="chip-row">
                {focusedDistrict.landmarks.map((landmark) => (
                  <span key={landmark} className="chip chip--soft">
                    {landmark}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {focusedPiece && focusedCharacter ? (
            <div className="story-city__occupant-group">
              <p className="field-label">Occupant</p>
              <div className="story-city__occupant">
                <span className={`piece-badge__icon piece-badge__icon--${focusedPiece.side}`}>
                  <PieceArt
                    side={focusedPiece.side}
                    kind={focusedPiece.kind}
                    className="board-piece-art board-piece-art--badge"
                  />
                </span>
                <div className="story-city__occupant-copy">
                  <p className="piece-badge__label">{focusedCharacter.fullName}</p>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="content-outline content-outline--city">
          <div className="detail-card__title-row story-section__title-row">
            <h3 className="story-section__title content-outline__heading">District</h3>
            <span className="content-outline__block content-outline__block--pill" />
          </div>
          <div className="content-outline__media-row">
            <span className="content-outline__block content-outline__block--avatar" />
            <span className="content-outline__block content-outline__block--line content-outline__block--line-short" />
          </div>
          <div className="content-outline__stack">
            <span className="content-outline__block content-outline__block--line" />
            <span className="content-outline__block content-outline__block--line content-outline__block--line-short" />
          </div>
          <div className="content-outline__group">
            <p className="field-label content-outline__section-label">Descriptors</p>
            <div className="content-outline__chips">
              <span className="content-outline__block content-outline__block--chip-wide" />
              <span className="content-outline__block content-outline__block--chip" />
              <span className="content-outline__block content-outline__block--chip" />
            </div>
          </div>
          <div className="content-outline__group">
            <p className="field-label content-outline__section-label">Landmarks</p>
            <div className="content-outline__chips">
              <span className="content-outline__block content-outline__block--chip" />
              <span className="content-outline__block content-outline__block--chip-wide" />
            </div>
          </div>
          <div className="content-outline__group">
            <p className="field-label content-outline__section-label">Occupant</p>
            <div className="content-outline__media-row">
              <span className="content-outline__block content-outline__block--avatar" />
              <span className="content-outline__block content-outline__block--line content-outline__block--line-short" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
