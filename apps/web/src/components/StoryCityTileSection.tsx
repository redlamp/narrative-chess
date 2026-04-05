import type { DistrictCell } from "@narrative-chess/content-schema";

type StoryCityTileSectionProps = {
  focusedSquareSummary: string;
  focusedDistrict: DistrictCell | null;
};

export function StoryCityTileSection({
  focusedSquareSummary,
  focusedDistrict
}: StoryCityTileSectionProps) {
  return (
    <>
      <p className="field-label">City Tile</p>
      <p className="muted">{focusedSquareSummary}</p>
      {focusedDistrict ? (
        <>
          <div className="detail-card__title-row">
            <h3>{focusedDistrict.name}</h3>
            <span className="side-pill side-pill--white">{focusedDistrict.square}</span>
          </div>
          <p className="detail-card__description">
            {focusedDistrict.locality} | {focusedDistrict.dayProfile}
          </p>
          <div className="chip-row">
            {focusedDistrict.descriptors.map((descriptor) => (
              <span key={descriptor} className="chip">
                {descriptor}
              </span>
            ))}
          </div>
          <div className="chip-row">
            {focusedDistrict.landmarks.map((landmark) => (
              <span key={landmark} className="chip chip--soft">
                {landmark}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="muted">Hover or focus a square to inspect the mapped district.</p>
      )}
    </>
  );
}
