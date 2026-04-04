import { describe, expect, it } from "vitest";
import edinburghBoardData from "../../../content/cities/edinburgh-board.json";
import {
  boardFiles,
  boardRanks,
  cityBoardSchema
} from "./index";

describe("cityBoardSchema", () => {
  it("parses the Edinburgh board and covers all 64 squares exactly once", () => {
    const board = cityBoardSchema.parse(edinburghBoardData);
    const seenSquares = new Set(board.districts.map((district) => district.square));
    const allSquares = boardFiles.flatMap((file) =>
      boardRanks.map((rank) => `${file}${rank}`)
    );

    expect(board.id).toBe("edinburgh");
    expect(board.districts).toHaveLength(64);
    expect(seenSquares.size).toBe(64);
    expect([...seenSquares].sort()).toEqual(allSquares.sort());
  });
});
