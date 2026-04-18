import { cityBoardSchema, type CityBoard } from "@narrative-chess/content-schema";
import edinburghBoardData from "../../../content/cities/edinburgh-board.json";
import londonBoardData from "../../../content/cities/london-board.json";
import { getSupabaseClient, hasSupabaseConfig } from "./lib/supabase";

export type CityBoardDefinition = {
  id: string;
  board: CityBoard;
  boardFileStem: string;
  displayLabel: string;
  publishedEditionId: string | null;
};

function parseCityBoard(value: unknown) {
  return cityBoardSchema.parse(value);
}

function boardsMatch(left: CityBoard, right: CityBoard) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function isSupabasePublishedCitiesEnabled() {
  return import.meta.env.VITE_ENABLE_SUPABASE_PUBLISHED_CITIES === "true";
}

export type PublishedCityBoardLoadResult = {
  board: CityBoard;
  source: "fallback" | "supabase";
  publishedEditionId: string | null;
  matchesFallback: boolean | null;
};

export const cityBoardDefinitions: CityBoardDefinition[] = [
  {
    id: "edinburgh",
    board: parseCityBoard(edinburghBoardData),
    boardFileStem: "edinburgh-board",
    displayLabel: "Edinburgh",
    publishedEditionId: "edinburgh-modern"
  },
  {
    id: "london",
    board: parseCityBoard(londonBoardData),
    boardFileStem: "london-board",
    displayLabel: "London",
    publishedEditionId: null
  }
];

export function getCityBoardDefinition(cityId: string) {
  return cityBoardDefinitions.find((definition) => definition.id === cityId) ?? null;
}

export async function loadPublishedCityBoard(
  definition: CityBoardDefinition
): Promise<PublishedCityBoardLoadResult> {
  if (!isSupabasePublishedCitiesEnabled() || !definition.publishedEditionId || !hasSupabaseConfig) {
    return {
      board: definition.board,
      source: "fallback",
      publishedEditionId: definition.publishedEditionId,
      matchesFallback: null
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      board: definition.board,
      source: "fallback",
      publishedEditionId: definition.publishedEditionId,
      matchesFallback: null
    };
  }

  const { data, error } = await supabase
    .from("city_versions")
    .select("payload")
    .eq("city_edition_id", definition.publishedEditionId)
    .eq("status", "published")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.payload) {
    return {
      board: definition.board,
      source: "fallback",
      publishedEditionId: definition.publishedEditionId,
      matchesFallback: null
    };
  }

  const board = parseCityBoard(data.payload);

  return {
    board,
    source: "supabase",
    publishedEditionId: definition.publishedEditionId,
    matchesFallback: boardsMatch(board, definition.board)
  };
}
