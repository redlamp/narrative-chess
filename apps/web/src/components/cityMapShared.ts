import type { CityBoard, DistrictCell, MoveRecord } from "@narrative-chess/content-schema";
import type { StyleSpecification } from "maplibre-gl";

export type MapViewMode = "map" | "satellite";

export type ActiveCityMapLocation = {
  center: [number, number];
  query: string;
  zoom: number;
  title: string;
  squareLabel: string | null;
};

type CityBounds = {
  west: number;
  east: number;
  south: number;
  north: number;
  center: [number, number];
};

const edinburghBounds: CityBounds = {
  west: -3.33,
  east: -3.08,
  south: 55.88,
  north: 55.995,
  center: [-3.1883, 55.9533]
};

function getCityBounds(cityBoard: CityBoard): CityBounds {
  if (cityBoard.name.toLowerCase() === "edinburgh") {
    return edinburghBounds;
  }

  return edinburghBounds;
}

function parseSquare(square: string) {
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number.parseInt(square.slice(1), 10) - 1;
  if (!Number.isFinite(file) || !Number.isFinite(rank) || file < 0 || file > 7 || rank < 0 || rank > 7) {
    return null;
  }

  return { file, rank };
}

export function getBoardSquareCenter(cityBoard: CityBoard, square: string): [number, number] {
  const parsedSquare = parseSquare(square);
  const bounds = getCityBounds(cityBoard);
  if (!parsedSquare) {
    return bounds.center;
  }

  const fileFraction = (parsedSquare.file + 0.5) / 8;
  const rankFraction = (parsedSquare.rank + 0.5) / 8;
  const longitude = bounds.west + (bounds.east - bounds.west) * fileFraction;
  const latitude = bounds.south + (bounds.north - bounds.south) * rankFraction;

  return [longitude, latitude];
}

export function buildDistrictQuery(cityBoard: CityBoard, district: DistrictCell) {
  const queryParts = [
    district.landmarks[0] ?? null,
    district.name,
    cityBoard.name,
    cityBoard.country
  ].filter((part, index, values): part is string => Boolean(part) && values.indexOf(part) === index);

  return queryParts.join(", ");
}

export function buildGoogleEmbedUrl(query: string, viewMode: MapViewMode, zoom: number) {
  const params = new URLSearchParams({
    q: query,
    z: String(zoom),
    t: viewMode === "satellite" ? "k" : "m",
    output: "embed"
  });

  return `https://www.google.com/maps?${params.toString()}`;
}

export function buildGoogleOpenUrl(query: string) {
  const params = new URLSearchParams({
    api: "1",
    query
  });

  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function buildOpenStreetMapUrl(center: [number, number], zoom: number) {
  const [longitude, latitude] = center;
  const params = new URLSearchParams({
    mlon: longitude.toFixed(5),
    mlat: latitude.toFixed(5)
  });

  return `https://www.openstreetmap.org/?${params.toString()}#map=${zoom}/${latitude.toFixed(5)}/${longitude.toFixed(5)}`;
}

export function getActiveCityMapLocation(input: {
  cityBoard: CityBoard;
  hoveredDistrict: DistrictCell | null;
  lastMoveDistrict: DistrictCell | null;
  lastMove: MoveRecord | null;
}): ActiveCityMapLocation {
  const { cityBoard, hoveredDistrict, lastMoveDistrict, lastMove } = input;

  if (hoveredDistrict) {
    return {
      center: getBoardSquareCenter(cityBoard, hoveredDistrict.square),
      query: buildDistrictQuery(cityBoard, hoveredDistrict),
      zoom: 14.75,
      title: hoveredDistrict.name,
      squareLabel: hoveredDistrict.square
    };
  }

  if (lastMoveDistrict && lastMove) {
    return {
      center: getBoardSquareCenter(cityBoard, lastMoveDistrict.square),
      query: buildDistrictQuery(cityBoard, lastMoveDistrict),
      zoom: 14,
      title: lastMoveDistrict.name,
      squareLabel: lastMove.to
    };
  }

  const bounds = getCityBounds(cityBoard);
  return {
    center: bounds.center,
    query: `${cityBoard.name}, ${cityBoard.country}`,
    zoom: 11.5,
    title: cityBoard.name,
    squareLabel: null
  };
}

export function createMapLibreRasterStyle(viewMode: MapViewMode): StyleSpecification {
  const sourceId = viewMode === "satellite" ? "esri-world-imagery" : "osm-standard";
  const tiles =
    viewMode === "satellite"
      ? ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"]
      : ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"];
  const attribution =
    viewMode === "satellite"
      ? "Imagery copyright Esri"
      : 'Map data copyright <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  return {
    version: 8,
    sources: {
      [sourceId]: {
        type: "raster",
        tiles,
        tileSize: 256,
        attribution
      }
    },
    layers: [
      {
        id: sourceId,
        type: "raster",
        source: sourceId,
        paint: {}
      }
    ]
  };
}
