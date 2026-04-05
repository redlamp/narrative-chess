import { describe, expect, it } from "vitest";
import { getNextBoardFocusSquare } from "./boardNavigation";

describe("getNextBoardFocusSquare", () => {
  it("moves around the board with arrow keys", () => {
    expect(getNextBoardFocusSquare("d4", "ArrowUp")).toBe("d5");
    expect(getNextBoardFocusSquare("d4", "ArrowDown")).toBe("d3");
    expect(getNextBoardFocusSquare("d4", "ArrowLeft")).toBe("c4");
    expect(getNextBoardFocusSquare("d4", "ArrowRight")).toBe("e4");
  });

  it("clamps movement at the board edges", () => {
    expect(getNextBoardFocusSquare("a8", "ArrowUp")).toBe("a8");
    expect(getNextBoardFocusSquare("a8", "ArrowLeft")).toBe("a8");
    expect(getNextBoardFocusSquare("h1", "ArrowDown")).toBe("h1");
    expect(getNextBoardFocusSquare("h1", "ArrowRight")).toBe("h1");
  });

  it("supports row start and row end navigation", () => {
    expect(getNextBoardFocusSquare("d4", "Home")).toBe("a4");
    expect(getNextBoardFocusSquare("d4", "End")).toBe("h4");
  });
});
