import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ExternalLink, Map as MapIcon, Satellite } from "lucide-react";
import type { CityBoard, DistrictCell, MoveRecord, PieceState } from "@narrative-chess/content-schema";
import { Button } from "@/components/ui/button";
import { getPieceAssetPath } from "@/chessPresentation";
import {
  buildOpenStreetMapUrl,
  createDistrictMarkerGeoJson,
  createMapLibreRasterStyle,
  getActiveCityMapLocation,
  getCityBoardMarkerBounds,
  getDistrictMapCenter,
  type MapViewMode
} from "./cityMapShared";

type CityMapLibrePanelProps = {
  cityBoard: CityBoard;
  pieces: PieceState[];
  selectedDistrict: DistrictCell | null;
  hoveredDistrict: DistrictCell | null;
  lastMoveDistrict: DistrictCell | null;
  lastMove: MoveRecord | null;
};

const districtMarkerSourceId = "district-markers";
const districtMarkerLayerId = "district-markers-layer";
const districtMarkerActiveLayerId = "district-markers-active-layer";
const districtMarkerLabelLayerId = "district-markers-label-layer";
const occupiedPieceSourceId = "district-piece-markers";
const occupiedPieceBackgroundLayerId = "district-piece-markers-background-layer";
const occupiedPieceLayerId = "district-piece-markers-layer";

const pieceIconDefinitions = [
  { side: "white", kind: "pawn" },
  { side: "white", kind: "rook" },
  { side: "white", kind: "knight" },
  { side: "white", kind: "bishop" },
  { side: "white", kind: "queen" },
  { side: "white", kind: "king" },
  { side: "black", kind: "pawn" },
  { side: "black", kind: "rook" },
  { side: "black", kind: "knight" },
  { side: "black", kind: "bishop" },
  { side: "black", kind: "queen" },
  { side: "black", kind: "king" }
] satisfies Array<{
  side: PieceState["side"];
  kind: PieceState["kind"];
}>;

function getPieceIconId(input: {
  side: PieceState["side"];
  kind: PieceState["kind"];
}) {
  return `map-piece-${input.side}-${input.kind}`;
}

function createOccupiedPieceGeoJson(input: {
  cityBoard: CityBoard;
  pieces: PieceState[];
  activeSquare: string | null;
}) {
  const { cityBoard, pieces, activeSquare } = input;

  return {
    type: "FeatureCollection" as const,
    features: pieces.flatMap((piece) => {
      if (!piece.square) {
        return [];
      }

      const district = cityBoard.districts.find((candidate) => candidate.square === piece.square);
      if (!district) {
        return [];
      }

      const [longitude, latitude] = getDistrictMapCenter(cityBoard, district);

      return [
        {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [longitude, latitude] as [number, number]
          },
          properties: {
            id: piece.pieceId,
            square: piece.square,
            isActive: piece.square === activeSquare ? 1 : 0,
            iconId: getPieceIconId({
              side: piece.side,
              kind: piece.promotedTo ?? piece.kind
            })
          }
        }
      ];
    })
  };
}

function ensureDistrictMarkerLayers(map: MapLibreMap, cityBoard: CityBoard, activeSquare: string | null) {
  const markerData = createDistrictMarkerGeoJson({
    cityBoard,
    activeSquare
  });
  const existingSource = map.getSource(districtMarkerSourceId) as GeoJSONSource | undefined;

  if (existingSource) {
    existingSource.setData(markerData);
    return;
  }

  map.addSource(districtMarkerSourceId, {
    type: "geojson",
    data: markerData
  });

  map.addLayer({
    id: districtMarkerLayerId,
    type: "circle",
    source: districtMarkerSourceId,
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        3,
        14,
        5
      ],
      "circle-color": "#111827",
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#ffffff",
      "circle-opacity": 0.85
    }
  });

  map.addLayer({
    id: districtMarkerActiveLayerId,
    type: "circle",
    source: districtMarkerSourceId,
    filter: ["==", ["get", "isActive"], 1],
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        6,
        14,
        9
      ],
      "circle-color": "#ffffff",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#111827",
      "circle-opacity": 0.95
    }
  });

  map.addLayer({
    id: districtMarkerLabelLayerId,
    type: "symbol",
    source: districtMarkerSourceId,
    layout: {
      "text-field": ["get", "square"],
      "text-size": 10,
      "text-font": ["Arial Unicode MS Regular"],
      "text-offset": [0, 1.5],
      "text-anchor": "top",
      "text-allow-overlap": false,
      "text-ignore-placement": false
    },
    paint: {
      "text-color": "#111827",
      "text-halo-color": "rgba(255,255,255,0.95)",
      "text-halo-width": 1.25
    },
    minzoom: 11
  });
}

async function ensurePieceMarkerIcons(map: MapLibreMap) {
  await Promise.all(
    pieceIconDefinitions.map(async (definition) => {
      const iconId = getPieceIconId(definition);
      if (map.hasImage(iconId)) {
        return;
      }

      const image = await map.loadImage(getPieceAssetPath(definition));
      if (!map.hasImage(iconId)) {
        map.addImage(iconId, image.data);
      }
    })
  );
}

async function syncOccupiedPieceLayer(input: {
  map: MapLibreMap;
  cityBoard: CityBoard;
  pieces: PieceState[];
  activeSquare: string | null;
}) {
  const { map, cityBoard, pieces, activeSquare } = input;
  await ensurePieceMarkerIcons(map);

  const markerData = createOccupiedPieceGeoJson({
    cityBoard,
    pieces,
    activeSquare
  });
  const existingSource = map.getSource(occupiedPieceSourceId) as GeoJSONSource | undefined;

  if (existingSource) {
    existingSource.setData(markerData);
    return;
  }

  map.addSource(occupiedPieceSourceId, {
    type: "geojson",
    data: markerData
  });

  map.addLayer({
    id: occupiedPieceBackgroundLayerId,
    type: "circle",
    source: occupiedPieceSourceId,
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        10,
        14,
        15
      ],
      "circle-color": "#ffffff",
      "circle-opacity": 0.96,
      "circle-stroke-width": [
        "case",
        ["==", ["get", "isActive"], 1],
        2.5,
        1.5
      ],
      "circle-stroke-color": [
        "case",
        ["==", ["get", "isActive"], 1],
        "#111827",
        "rgba(17,24,39,0.28)"
      ]
    }
  });

  map.addLayer({
    id: occupiedPieceLayerId,
    type: "symbol",
    source: occupiedPieceSourceId,
    layout: {
      "icon-image": ["get", "iconId"],
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        0.12,
        14,
        0.2
      ],
      "icon-anchor": "center",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true
    }
  });
}

export function CityMapLibrePanel({
  cityBoard,
  pieces,
  selectedDistrict,
  hoveredDistrict,
  lastMoveDistrict,
  lastMove
}: CityMapLibrePanelProps) {
  const [viewMode, setViewMode] = useState<MapViewMode>("map");
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hasHydratedCamera = useRef(false);
  const activeLocation = useMemo(
    () =>
      getActiveCityMapLocation({
        cityBoard,
        selectedDistrict,
        hoveredDistrict,
        lastMoveDistrict,
        lastMove
      }),
    [cityBoard, hoveredDistrict, lastMove, lastMoveDistrict, selectedDistrict]
  );
  const highlightedSquare = hoveredDistrict?.square ?? selectedDistrict?.square ?? lastMove?.to ?? null;
  const cameraSquare = selectedDistrict?.square ?? null;
  const cityBoardBounds = useMemo(() => getCityBoardMarkerBounds(cityBoard), [cityBoard]);
  const openUrl = useMemo(
    () => buildOpenStreetMapUrl(activeLocation.center, Math.round(activeLocation.zoom)),
    [activeLocation.center, activeLocation.zoom]
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: createMapLibreRasterStyle(viewMode),
      center: activeLocation.center,
      zoom: activeLocation.zoom,
      attributionControl: {}
    });

    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.on("load", () => {
      ensureDistrictMarkerLayers(map, cityBoard, highlightedSquare);
      void syncOccupiedPieceLayer({
        map,
        cityBoard,
        pieces,
        activeSquare: highlightedSquare
      });
    });
    mapRef.current = map;
    hasHydratedCamera.current = false;

    return () => {
      map.remove();
      mapRef.current = null;
      hasHydratedCamera.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.setStyle(createMapLibreRasterStyle(viewMode));
    map.once("styledata", () => {
      ensureDistrictMarkerLayers(map, cityBoard, highlightedSquare);
      void syncOccupiedPieceLayer({
        map,
        cityBoard,
        pieces,
        activeSquare: highlightedSquare
      }).finally(() => {
        map.resize();
      });
    });
  }, [cityBoard, highlightedSquare, pieces, viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    ensureDistrictMarkerLayers(map, cityBoard, highlightedSquare);
    void syncOccupiedPieceLayer({
      map,
      cityBoard,
      pieces,
      activeSquare: highlightedSquare
    });
  }, [cityBoard, highlightedSquare, pieces]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!hasHydratedCamera.current) {
      if (cameraSquare) {
        map.jumpTo({
          center: activeLocation.center,
          zoom: activeLocation.zoom
        });
      } else {
        map.fitBounds(cityBoardBounds, {
          padding: 40,
          duration: 0,
          maxZoom: 12.25
        });
      }
      hasHydratedCamera.current = true;
      return;
    }

    map.stop();

    if (cameraSquare) {
      map.flyTo({
        center: activeLocation.center,
        zoom: activeLocation.zoom,
        duration: 1000,
        essential: true,
        curve: 0.5,
        speed: 1
      });
      return;
    }

    map.fitBounds(cityBoardBounds, {
      padding: 40,
      duration: 500,
      essential: true,
      maxZoom: 12.25
    });
  }, [activeLocation.center, activeLocation.zoom, cameraSquare, cityBoardBounds]);

  useEffect(() => {
    const map = mapRef.current;
    const node = mapContainerRef.current;
    if (!map || !node || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      map.resize();
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="city-map-panel city-map-panel--maplibre">
      <div className="city-map-panel__meta">
        <div className="city-map-panel__meta-row">
          <h3 className="city-map-panel__title">{activeLocation.title}</h3>
          {activeLocation.squareLabel ? (
            <span className="side-pill side-pill--compact side-pill--white">
              {activeLocation.squareLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="city-map-panel__frame">
        <div ref={mapContainerRef} className="city-maplibre-panel__canvas" />
      </div>

      <div className="city-map-panel__toolbar">
        <div className="city-map-panel__toggle-group" role="group" aria-label="Map imagery">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "map" ? "secondary" : "outline"}
            onClick={() => setViewMode("map")}
          >
            <MapIcon />
            Map
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "satellite" ? "secondary" : "outline"}
            onClick={() => setViewMode("satellite")}
          >
            <Satellite />
            Satellite
          </Button>
        </div>
        <Button asChild type="button" size="sm" variant="outline">
          <a href={openUrl} target="_blank" rel="noreferrer">
            Open In OpenStreetMap
            <ExternalLink />
          </a>
        </Button>
      </div>
    </div>
  );
}
