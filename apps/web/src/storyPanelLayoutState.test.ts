import { describe, expect, it } from "vitest";
import {
  getDefaultStoryPanelLayoutState,
  normalizeStoryPanelLayoutState,
  updateStoryPanelRect
} from "./storyPanelLayoutState";

describe("storyPanelLayoutState", () => {
  it("normalizes out-of-range panel values", () => {
    const normalized = normalizeStoryPanelLayoutState({
      columnCount: 99,
      columnGap: -4,
      rowHeight: 999,
      panels: {
        beat: { x: -20, y: -5, w: 999, h: 1 }
      }
    });

    expect(normalized.columnCount).toBe(16);
    expect(normalized.columnGap).toBe(0);
    expect(normalized.rowHeight).toBe(120);
    expect(normalized.panels.beat.x).toBe(1);
    expect(normalized.panels.beat.y).toBe(1);
    expect(normalized.panels.beat.w).toBe(16);
    expect(normalized.panels.beat.h).toBe(2);
  });

  it("updates a panel rect while keeping the layout normalized", () => {
    const nextState = updateStoryPanelRect({
      layoutState: getDefaultStoryPanelLayoutState(),
      panelId: "tone",
      nextRect: {
        x: 7,
        y: 12,
        w: 8,
        h: 3
      }
    });

    expect(nextState.panels.tone.x).toBe(1);
    expect(nextState.panels.tone.w).toBe(8);
    expect(nextState.panels.tone.y).toBe(12);
    expect(nextState.panels.tone.h).toBe(3);
  });
});
