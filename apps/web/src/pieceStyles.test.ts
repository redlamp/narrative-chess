import { describe, expect, it } from "vitest";
import {
  defaultPieceStyleSheet,
  listPieceStyleSheet,
  resetPieceStyleSheet,
  savePieceStyleSheet
} from "./pieceStyles";

describe("pieceStyles", () => {
  it("falls back to the default stylesheet", () => {
    window.localStorage.clear();

    expect(listPieceStyleSheet()).toBe(defaultPieceStyleSheet);
  });

  it("saves and resets the stylesheet", () => {
    window.localStorage.clear();

    const saved = savePieceStyleSheet(".board-square__piece { filter: none; }");
    expect(saved).toContain("filter: none");
    expect(listPieceStyleSheet()).toContain("filter: none");

    const reset = resetPieceStyleSheet();
    expect(reset).toBe(defaultPieceStyleSheet);
  });
});
