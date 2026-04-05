import { cityBoardSchema, type CityBoard } from "@narrative-chess/content-schema";
import edinburghBoardData from "../../../content/cities/edinburgh-board.json";
import londonBoardData from "../../../content/cities/london-board.json";

export type CityBoardDefinition = {
  id: string;
  board: CityBoard;
  boardFileStem: string;
  displayLabel: string;
};

function parseCityBoard(value: unknown) {
  return cityBoardSchema.parse(value);
}

export const cityBoardDefinitions: CityBoardDefinition[] = [
  {
    id: "edinburgh",
    board: parseCityBoard(edinburghBoardData),
    boardFileStem: "edinburgh-board",
    displayLabel: "Edinburgh"
  },
  {
    id: "london",
    board: parseCityBoard(londonBoardData),
    boardFileStem: "london-board",
    displayLabel: "London"
  }
];

export function getCityBoardDefinition(cityId: string) {
  return cityBoardDefinitions.find((definition) => definition.id === cityId) ?? null;
}
