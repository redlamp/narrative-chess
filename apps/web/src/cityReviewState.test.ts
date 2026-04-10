import { beforeEach, describe, expect, it } from "vitest";
import { getCityBoardDefinition } from "./cityBoards";
import {
  buildCityBoardValidation,
  listCityBoardDraft,
  listCityBoardSavedBaseline,
  resetCityBoardDraft,
  saveCityBoardDraft,
  saveCityBoardSavedBaseline
} from "./cityReviewState";

describe("cityReviewState", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("supports independent drafts for multiple cities", () => {
    const london = getCityBoardDefinition("london")?.board;

    expect(london).toBeTruthy();
    if (!london) {
      return;
    }

    const initialDraft = listCityBoardDraft("london", london);
    expect(initialDraft.id).toBe("london");

    const nextDraft = saveCityBoardDraft({
      ...initialDraft,
      reviewNotes: "Local working note"
    });

    expect(nextDraft.reviewNotes).toBe("Local working note");
    expect(listCityBoardDraft("london", london).reviewNotes).toBe("Local working note");
    expect(resetCityBoardDraft("london", london).reviewNotes).toBe(london.reviewNotes);
  });

  it("preserves district map anchors while hydrating drafts", () => {
    const london = getCityBoardDefinition("london")?.board;

    expect(london).toBeTruthy();
    if (!london) {
      return;
    }

    const initialDraft = listCityBoardDraft("london", london);
    const nextDraft = saveCityBoardDraft({
      ...initialDraft,
      districts: initialDraft.districts.map((district, index) =>
        index === 0
          ? {
              ...district,
              mapAnchor: {
                longitude: -0.1276,
                latitude: 51.5072
              }
            }
          : district
      )
    });

    expect(nextDraft.districts[0]?.mapAnchor).toEqual({
      longitude: -0.1276,
      latitude: 51.5072
    });
    expect(listCityBoardDraft("london", london).districts[0]?.mapAnchor).toEqual({
      longitude: -0.1276,
      latitude: 51.5072
    });
  });

  it("tracks a saved baseline separately from the working draft", () => {
    const london = getCityBoardDefinition("london")?.board;

    expect(london).toBeTruthy();
    if (!london) {
      return;
    }

    const initialDraft = listCityBoardDraft("london", london);
    saveCityBoardSavedBaseline({
      ...initialDraft,
      reviewNotes: "Saved baseline"
    });
    saveCityBoardDraft({
      ...initialDraft,
      reviewNotes: "Working draft"
    });

    expect(listCityBoardSavedBaseline("london", london).reviewNotes).toBe("Saved baseline");
    expect(listCityBoardDraft("london", london).reviewNotes).toBe("Working draft");
  });

  it("validates bundled city boards", () => {
    const edinburgh = getCityBoardDefinition("edinburgh")?.board;

    expect(edinburgh).toBeTruthy();
    if (!edinburgh) {
      return;
    }

    const validation = buildCityBoardValidation(edinburgh);

    expect(validation.isValid).toBe(true);
    expect(validation.issues).toHaveLength(0);
  });
});
