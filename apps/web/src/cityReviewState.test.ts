import { beforeEach, describe, expect, it } from "vitest";
import { getCityBoardDefinition } from "./cityBoards";
import {
  buildCityBoardValidation,
  listCityBoardDraft,
  resetCityBoardDraft,
  saveCityBoardDraft
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
