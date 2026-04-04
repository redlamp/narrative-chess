import { describe, expect, it } from "vitest";
import {
  createEdinburghBoardDraft,
  formatMultilineList,
  parseMultilineList,
  updateEdinburghBoardMeta,
  updateEdinburghDistrictField
} from "./edinburghReviewState";

describe("edinburghReviewState", () => {
  it("creates a valid draft from the checked-in Edinburgh board", () => {
    const boardDraft = createEdinburghBoardDraft();

    expect(boardDraft.id).toBe("edinburgh");
    expect(boardDraft.districts).toHaveLength(64);
  });

  it("formats and parses multiline list fields", () => {
    expect(formatMultilineList(["harbour", "historic"])).toBe("harbour\nhistoric");
    expect(parseMultilineList("harbour\nhistoric\nharbour")).toEqual([
      "harbour",
      "historic",
      "harbour"
    ]);
  });

  it("updates board metadata through the shared schema", () => {
    const boardDraft = createEdinburghBoardDraft();
    const nextBoard = updateEdinburghBoardMeta(boardDraft, "contentStatus", "procedural");

    expect(nextBoard.contentStatus).toBe("procedural");
  });

  it("updates district fields through the shared schema", () => {
    const boardDraft = createEdinburghBoardDraft();
    const targetDistrict = boardDraft.districts[0];
    const nextDescriptors = ["coastal", "village core"];
    const nextBoard = updateEdinburghDistrictField(
      boardDraft,
      targetDistrict.id,
      "descriptors",
      nextDescriptors
    );

    expect(nextBoard.districts[0]?.descriptors).toEqual(nextDescriptors);
    expect(nextBoard.districts[1]?.descriptors).toEqual(boardDraft.districts[1]?.descriptors);
  });
});
