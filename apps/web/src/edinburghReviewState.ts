import {
  cityBoardSchema,
  type CityBoard,
  type ContentStatus,
  type DistrictCell,
  type ReviewStatus
} from "@narrative-chess/content-schema";
import { edinburghBoard } from "./edinburghBoard";

const edinburghBoardDraftStorageKey = "narrative-chess:edinburgh-board-draft";

type CityBoardMetaUpdate = Pick<
  CityBoard,
  | "summary"
  | "boardOrientation"
  | "sourceUrls"
  | "generationSource"
  | "contentStatus"
  | "reviewStatus"
  | "reviewNotes"
  | "lastReviewedAt"
>;

function cloneBoard(board: CityBoard) {
  return cityBoardSchema.parse(JSON.parse(JSON.stringify(board)) as unknown);
}

export function createEdinburghBoardDraft() {
  return cloneBoard(edinburghBoard);
}

export function listEdinburghBoardDraft() {
  if (typeof window === "undefined") {
    return createEdinburghBoardDraft();
  }

  const storedValue = window.localStorage.getItem(edinburghBoardDraftStorageKey);
  if (!storedValue) {
    return createEdinburghBoardDraft();
  }

  try {
    return cityBoardSchema.parse(JSON.parse(storedValue) as unknown);
  } catch {
    return createEdinburghBoardDraft();
  }
}

export function saveEdinburghBoardDraft(board: CityBoard) {
  const parsedBoard = cityBoardSchema.parse(board);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(edinburghBoardDraftStorageKey, JSON.stringify(parsedBoard));
  }

  return parsedBoard;
}

export function resetEdinburghBoardDraft() {
  const nextBoard = createEdinburghBoardDraft();

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(edinburghBoardDraftStorageKey);
  }

  return nextBoard;
}

export function formatMultilineList(values: string[]) {
  return values.join("\n");
}

export function parseMultilineList(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function updateEdinburghBoardMeta(
  board: CityBoard,
  field: keyof CityBoardMetaUpdate,
  value:
    | string
    | string[]
    | ContentStatus
    | ReviewStatus
    | null
) {
  return cityBoardSchema.parse({
    ...board,
    [field]: value
  });
}

export function updateEdinburghDistrictField(
  board: CityBoard,
  districtId: string,
  field: keyof DistrictCell,
  value:
    | string
    | string[]
    | ContentStatus
    | ReviewStatus
    | null
) {
  return cityBoardSchema.parse({
    ...board,
    districts: board.districts.map((district) =>
      district.id === districtId
        ? {
            ...district,
            [field]: value
          }
        : district
    )
  });
}
