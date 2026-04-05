import type { ReactNode } from "react";
import { Columns2, Grid2x2, Rows3 } from "lucide-react";
import type {
  CharacterSummary,
  DistrictCell,
  MoveRecord,
  NarrativeEvent,
  PieceState,
  Square
} from "@narrative-chess/content-schema";
import { Button } from "@/components/ui/button";
import { getPieceDisplayName, getPieceGlyph, getPieceKindLabel } from "../chessPresentation";
import { Panel } from "./Panel";

type StoryPanelProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  selectedMove: MoveRecord | null;
  selectedEvent: NarrativeEvent | null;
  focusedSquare: Square | null;
  focusedSquareSummary: string;
  focusedDistrict: DistrictCell | null;
  focusedPiece: PieceState | null;
  focusedCharacter: CharacterSummary | null;
  focusedCharacterMoments: NarrativeEvent[];
  showRecentCharacterActions: boolean;
  panelLayout: "vertical" | "grid" | "row";
  onPanelLayoutChange: (layout: "vertical" | "grid" | "row") => void;
  tonePreset: "grounded" | "civic-noir" | "dark-comedy";
  onToneChange: (tone: "grounded" | "civic-noir" | "dark-comedy") => void;
  headerAction?: ReactNode;
};

const storyPanelLayouts = ["vertical", "grid", "row"] as const;

function getNextStoryPanelLayout(current: StoryPanelProps["panelLayout"]) {
  const currentIndex = storyPanelLayouts.indexOf(current);
  return storyPanelLayouts[(currentIndex + 1) % storyPanelLayouts.length];
}

function getStoryPanelLayoutLabel(layout: StoryPanelProps["panelLayout"]) {
  switch (layout) {
    case "grid":
      return "grid";
    case "row":
      return "horizontal row";
    default:
      return "vertical stack";
  }
}

function getStoryPanelLayoutIcon(layout: StoryPanelProps["panelLayout"]) {
  switch (layout) {
    case "grid":
      return <Grid2x2 />;
    case "row":
      return <Columns2 />;
    default:
      return <Rows3 />;
  }
}

export function StoryPanel({
  collapsed,
  onToggleCollapse,
  selectedMove,
  selectedEvent,
  focusedSquare,
  focusedSquareSummary,
  focusedDistrict,
  focusedPiece,
  focusedCharacter,
  focusedCharacterMoments,
  showRecentCharacterActions,
  panelLayout,
  onPanelLayoutChange,
  tonePreset,
  onToneChange,
  headerAction
}: StoryPanelProps) {
  return (
    <Panel
      title="Story"
      collapsed={collapsed}
      leadingAction={
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onPanelLayoutChange(getNextStoryPanelLayout(panelLayout))}
          aria-label={`Switch story panel layout. Current layout is ${getStoryPanelLayoutLabel(panelLayout)}.`}
          title={`Story layout: ${getStoryPanelLayoutLabel(panelLayout)}`}
        >
          {getStoryPanelLayoutIcon(panelLayout)}
        </Button>
      }
      action={headerAction}
      onToggleCollapse={onToggleCollapse}
    >
      <div
        className={`story-panel ${
          panelLayout === "grid"
            ? "story-panel--grid"
            : panelLayout === "row"
              ? "story-panel--row"
              : "story-panel--vertical"
        }`}
      >
        <div className="detail-card">
          <p className="field-label">Selected beat</p>
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
        </div>

        <div className="detail-card">
          <p className="field-label">City tile</p>
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
        </div>

        <div className="detail-card">
          <p className="field-label">Character on tile</p>
          {focusedCharacter && focusedPiece ? (
            <>
              <div className="piece-badge">
                <span className={`piece-badge__icon piece-badge__icon--${focusedPiece.side}`}>
                  {getPieceGlyph({ side: focusedPiece.side, kind: focusedPiece.kind })}
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
              <div className="chip-row">
                {focusedCharacter.traits.map((trait) => (
                  <span key={trait} className="chip">
                    {trait}
                  </span>
                ))}
              </div>
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
        </div>

        <div className="detail-card">
          <p className="field-label">Narrative tone</p>
          <div className="tone-switcher">
            <Button
              type="button"
              variant={tonePreset === "grounded" ? "secondary" : "outline"}
              size="sm"
              onClick={() => onToneChange("grounded")}
            >
              Grounded
            </Button>
            <Button
              type="button"
              variant={tonePreset === "civic-noir" ? "secondary" : "outline"}
              size="sm"
              onClick={() => onToneChange("civic-noir")}
            >
              Civic noir
            </Button>
            <Button
              type="button"
              variant={tonePreset === "dark-comedy" ? "secondary" : "outline"}
              size="sm"
              onClick={() => onToneChange("dark-comedy")}
            >
              Dark comedy
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
