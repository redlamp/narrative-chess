import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode
} from "react";
import { Grip, LayoutDashboard } from "lucide-react";
import type {
  CharacterSummary,
  DistrictCell,
  MoveRecord,
  NarrativeEvent,
  PieceState,
  Square
} from "@narrative-chess/content-schema";
import { Button } from "@/components/ui/button";
import { getPieceDisplayName, getPieceKindLabel } from "../chessPresentation";
import {
  getSnappedStoryPanelColumn,
  getSnappedStoryPanelRow,
  getStoryPanelLayoutRowCount,
  storyPanelSectionIds,
  type StoryPanelLayoutState,
  type StoryPanelSectionId,
  type StoryPanelSectionRect
} from "../storyPanelLayoutState";
import { Panel } from "./Panel";
import { PieceArt } from "./PieceArt";

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
  layoutState: StoryPanelLayoutState;
  layoutMode: boolean;
  onToggleLayoutMode: () => void;
  onLayoutRectChange: (panelId: StoryPanelSectionId, nextRect: StoryPanelSectionRect) => void;
  tonePreset: "grounded" | "civic-noir" | "dark-comedy";
  onToneChange: (tone: "grounded" | "civic-noir" | "dark-comedy") => void;
  headerAction?: ReactNode;
};

type StoryLayoutEditMode = "move" | "resize";

type ActiveStoryLayoutEdit = {
  panelId: StoryPanelSectionId;
  mode: StoryLayoutEditMode;
  originColumn: number;
  originRow: number;
  initialRect: StoryPanelSectionRect;
};

function getStoryPanelStyle(
  layoutState: StoryPanelLayoutState,
  panelId: StoryPanelSectionId
): CSSProperties {
  const panel = layoutState.panels[panelId];
  const area = panel.w * panel.h;
  const zIndex = 1000 - area * 10 - panel.w - panel.h;
  const columnOffset = Math.max(0, panel.x - 1);
  const rowOffset = Math.max(0, panel.y - 1);

  return {
    left: `calc(((100% - (var(--story-layout-gap) * (var(--story-layout-column-count) - 1))) / var(--story-layout-column-count) * ${columnOffset}) + (var(--story-layout-gap) * ${columnOffset}))`,
    top: `calc((var(--story-layout-row-height) * ${rowOffset}) + (var(--story-layout-gap) * ${rowOffset}))`,
    width: `calc(((100% - (var(--story-layout-gap) * (var(--story-layout-column-count) - 1))) / var(--story-layout-column-count) * ${panel.w}) + (var(--story-layout-gap) * ${Math.max(panel.w - 1, 0)}))`,
    height: `calc((var(--story-layout-row-height) * ${panel.h}) + (var(--story-layout-gap) * ${Math.max(panel.h - 1, 0)}))`,
    zIndex
  };
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
  layoutState,
  layoutMode,
  onToggleLayoutMode,
  onLayoutRectChange,
  tonePreset,
  onToneChange,
  headerAction
}: StoryPanelProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [activeEdit, setActiveEdit] = useState<ActiveStoryLayoutEdit | null>(null);
  const rowCount = useMemo(() => getStoryPanelLayoutRowCount(layoutState), [layoutState]);
  const layoutStyle = useMemo(
    () =>
      ({
        "--story-layout-column-count": String(layoutState.columnCount),
        "--story-layout-gap": `${layoutState.columnGap}px`,
        "--story-layout-row-height": `${layoutState.rowHeight}px`,
        "--story-layout-row-count": String(rowCount)
      }) as CSSProperties,
    [layoutState.columnCount, layoutState.columnGap, layoutState.rowHeight, rowCount]
  );

  useEffect(() => {
    if (!activeEdit) {
      return;
    }

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const currentColumn = getSnappedStoryPanelColumn({
        offsetX: event.clientX - rect.left,
        width: rect.width,
        columnCount: layoutState.columnCount,
        columnGap: layoutState.columnGap
      });
      const currentRow = getSnappedStoryPanelRow({
        offsetY: event.clientY - rect.top,
        rowHeight: layoutState.rowHeight,
        rowGap: layoutState.columnGap
      });
      const deltaColumns = currentColumn - activeEdit.originColumn;
      const deltaRows = currentRow - activeEdit.originRow;

      const nextRect =
        activeEdit.mode === "move"
          ? {
              ...activeEdit.initialRect,
              x: activeEdit.initialRect.x + deltaColumns,
              y: activeEdit.initialRect.y + deltaRows
            }
          : {
              ...activeEdit.initialRect,
              w: activeEdit.initialRect.w + deltaColumns,
              h: activeEdit.initialRect.h + deltaRows
            };

      onLayoutRectChange(activeEdit.panelId, nextRect);
    };

    const handlePointerUp = () => {
      setActiveEdit(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activeEdit, layoutState.columnCount, layoutState.columnGap, layoutState.rowHeight, onLayoutRectChange]);

  const beginEdit =
    (panelId: StoryPanelSectionId, mode: StoryLayoutEditMode) =>
    (event: PointerEvent<HTMLButtonElement>) => {
      if (!layoutMode || !canvasRef.current) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const rect = canvasRef.current.getBoundingClientRect();
      const originColumn = getSnappedStoryPanelColumn({
        offsetX: event.clientX - rect.left,
        width: rect.width,
        columnCount: layoutState.columnCount,
        columnGap: layoutState.columnGap
      });
      const originRow = getSnappedStoryPanelRow({
        offsetY: event.clientY - rect.top,
        rowHeight: layoutState.rowHeight,
        rowGap: layoutState.columnGap
      });

      setActiveEdit({
        panelId,
        mode,
        originColumn,
        originRow,
        initialRect: layoutState.panels[panelId]
      });
    };

  const sectionPanels: Record<StoryPanelSectionId, ReactNode> = {
    beat: (
      <>
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
      </>
    ),
    tile: (
      <>
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
      </>
    ),
    character: (
      <>
        <p className="field-label">Character on tile</p>
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
      </>
    ),
    tone: (
      <>
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
      </>
    )
  };

  return (
    <Panel
      title="Story"
      collapsed={collapsed}
      leadingAction={
        <Button
          type="button"
          variant={layoutMode ? "secondary" : "ghost"}
          size="icon-xs"
          onClick={onToggleLayoutMode}
          aria-label={layoutMode ? "Exit story layout edit mode" : "Edit story sublayout"}
          title={layoutMode ? "Exit story layout edit mode" : "Edit story sublayout"}
        >
          <LayoutDashboard />
        </Button>
      }
      action={headerAction}
      onToggleCollapse={onToggleCollapse}
    >
      <div
        ref={canvasRef}
        className={`story-layout ${layoutMode ? "story-layout--editing" : ""}`}
        style={layoutStyle}
      >
        {layoutMode ? (
          <div className="story-layout__overlay" aria-hidden="true">
            {Array.from({ length: layoutState.columnCount * rowCount }, (_, index) => (
              <span key={index} className="story-layout__overlay-cell" />
            ))}
          </div>
        ) : null}
        {storyPanelSectionIds.map((panelId) => (
          <article
            key={panelId}
            className={`detail-card story-layout__item ${
              activeEdit?.panelId === panelId ? "story-layout__item--editing" : ""
            }`}
            style={getStoryPanelStyle(layoutState, panelId)}
          >
            {sectionPanels[panelId]}
            {layoutMode ? (
              <>
                <button
                  type="button"
                  className="story-layout__move-surface"
                  aria-label={`Move ${panelId} card`}
                  onPointerDown={beginEdit(panelId, "move")}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  className="story-layout__resize-handle"
                  aria-label={`Resize ${panelId} card`}
                  onPointerDown={beginEdit(panelId, "resize")}
                >
                  <Grip />
                </Button>
              </>
            ) : null}
          </article>
        ))}
      </div>
    </Panel>
  );
}
