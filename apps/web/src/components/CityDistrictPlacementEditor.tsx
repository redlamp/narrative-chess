import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ExternalLink, Map as MapIcon, MapPinOff, Satellite } from "lucide-react";
import { createSnapshotFromFen, getBoardSquares } from "@narrative-chess/game-core";
import type { CityBoard, DistrictCell, Square } from "@narrative-chess/content-schema";
import { Button } from "@/components/ui/button";
import { Board } from "./Board";
import {
  buildOpenStreetMapUrl,
  createDistrictRadiusGeoJson,
  createDistrictMarkerGeoJson,
  createMapLibreRasterStyle,
  getCityBoardMarkerBounds,
  getDistrictMapCenter,
  getDistrictRadiusMeters,
  type MapViewMode
} from "./cityMapShared";

type CityDistrictBoardEditorProps = {
  cityBoard: CityBoard;
  selectedDistrict: DistrictCell | null;
  highlightedDistrict: DistrictCell | null;
  hoveredSquare: Square | null;
  onHoveredSquareChange: (square: Square | null) => void;
  onSquareChange: (square: Square) => void;
  onSelectDistrict: (districtId: string) => void;
};

type CityDistrictMapEditorProps = {
  cityBoard: CityBoard;
  selectedDistrict: DistrictCell | null;
  highlightedDistrict: DistrictCell | null;
  locationSearchRequest: {
    token: number;
    query: string;
  } | null;
  onMapAnchorChange: (anchor: DistrictCell["mapAnchor"]) => void;
  onHighlightedDistrictChange: (districtId: string | null) => void;
  onSelectDistrict: (districtId: string) => void;
  importModeArmed: boolean;
  onImportModeConsumed: () => void;
};

const previewBoardFen = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
const markerSourceId = "city-review-district-markers";
const markerLayerId = "city-review-district-markers-layer";
const markerActiveLayerId = "city-review-district-markers-active-layer";
const markerLabelLayerId = "city-review-district-markers-label-layer";
const radiusSourceId = "city-review-district-radius";
const radiusFillLayerId = "city-review-district-radius-fill";
const radiusStrokeLayerId = "city-review-district-radius-stroke";
const radiusStrokeColor = "#4b5563";

type NominatimSearchResult = {
  lat: string;
  lon: string;
  display_name: string;
};

async function searchLocationByName(input: {
  query: string;
  viewbox: [[number, number], [number, number]];
  signal: AbortSignal;
}) {
  const params = new URLSearchParams({
    q: input.query,
    format: "jsonv2",
    limit: "1",
    addressdetails: "1",
    "accept-language": "en"
  });
  const [[west, south], [east, north]] = input.viewbox;
  params.set("viewbox", `${west},${south},${east},${north}`);

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    signal: input.signal,
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Search failed with status ${response.status}`);
  }

  const results = (await response.json()) as NominatimSearchResult[];
  const match = results[0];
  if (!match) {
    return null;
  }

  return {
    center: [Number(match.lon), Number(match.lat)] as [number, number],
    label: match.display_name
  };
}

function getDistrictRadiusBounds(cityBoard: CityBoard, district: DistrictCell) {
  const [longitude, latitude] = getDistrictMapCenter(cityBoard, district);
  const radiusMeters = getDistrictRadiusMeters(district);
  const latitudeDelta = radiusMeters / 111320;
  const longitudeDelta = radiusMeters / (111320 * Math.max(0.01, Math.cos(latitude * Math.PI / 180)));

  return new maplibregl.LngLatBounds(
    [longitude - longitudeDelta, latitude - latitudeDelta],
    [longitude + longitudeDelta, latitude + latitudeDelta]
  );
}

function syncDistrictMarkerLayers(
  map: MapLibreMap,
  cityBoard: CityBoard,
  activeDistrict: DistrictCell | null
) {
  const activeSquare = activeDistrict?.square ?? null;
  const radiusData = createDistrictRadiusGeoJson({
    cityBoard,
    districts: cityBoard.districts,
    activeDistrictId: activeDistrict?.id ?? null
  });
  const existingRadiusSource = map.getSource(radiusSourceId) as GeoJSONSource | undefined;

  if (existingRadiusSource) {
    existingRadiusSource.setData(radiusData);
  } else {
    map.addSource(radiusSourceId, {
      type: "geojson",
      data: radiusData
    });

    map.addLayer({
      id: radiusFillLayerId,
      type: "fill",
      source: radiusSourceId,
      paint: {
        "fill-color": "#f0abfc",
        "fill-opacity": [
          "case",
          ["==", ["get", "isActive"], 1],
          0.22,
          0.07
        ]
      }
    });

    map.addLayer({
      id: radiusStrokeLayerId,
      type: "line",
      source: radiusSourceId,
      paint: {
        "line-color": radiusStrokeColor,
        "line-opacity": [
          "case",
          ["==", ["get", "isActive"], 1],
          0.78,
          0.26
        ],
        "line-width": [
          "case",
          ["==", ["get", "isActive"], 1],
          1.75,
          1
        ]
      }
    });
  }

  const markerData = createDistrictMarkerGeoJson({
    cityBoard,
    activeSquare
  });
  const existingSource = map.getSource(markerSourceId) as GeoJSONSource | undefined;

  if (existingSource) {
    existingSource.setData(markerData);
    return;
  }

  map.addSource(markerSourceId, {
    type: "geojson",
    data: markerData
  });

  map.addLayer({
    id: markerLayerId,
    type: "circle",
    source: markerSourceId,
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        9,
        3,
        14,
        5
      ],
      "circle-color": "#111827",
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#ffffff",
      "circle-opacity": 0.9
    }
  });

  map.addLayer({
    id: markerActiveLayerId,
    type: "circle",
    source: markerSourceId,
    filter: ["==", ["get", "isActive"], 1],
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        9,
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
    id: markerLabelLayerId,
    type: "symbol",
    source: markerSourceId,
    layout: {
      "text-field": ["get", "square"],
      "text-size": 10,
      "text-font": ["Arial Unicode MS Regular"],
      "text-offset": [0, 1.4],
      "text-anchor": "top",
      "text-allow-overlap": false
    },
    paint: {
      "text-color": "#111827",
      "text-halo-color": "rgba(255,255,255,0.95)",
      "text-halo-width": 1.25
    },
    minzoom: 10.5
  });
}

export function CityDistrictBoardEditor({
  cityBoard,
  selectedDistrict,
  highlightedDistrict,
  hoveredSquare,
  onHoveredSquareChange,
  onSquareChange,
  onSelectDistrict
}: CityDistrictBoardEditorProps) {
  const previewSnapshot = useMemo(() => createSnapshotFromFen(previewBoardFen), []);
  const previewCells = useMemo(() => getBoardSquares(previewSnapshot), [previewSnapshot]);
  const districtsBySquare = useMemo(
    () => new Map(cityBoard.districts.map((district) => [district.square, district] as const)),
    [cityBoard.districts]
  );
  const activeDistrict = highlightedDistrict ?? selectedDistrict;

  return (
    <div className="city-placement-editor__board">
      <Board
        snapshot={previewSnapshot}
        cells={previewCells}
        selectedSquare={selectedDistrict?.square ?? null}
        hoveredSquare={hoveredSquare}
        inspectedSquare={activeDistrict?.square ?? null}
        legalMoves={[]}
        viewMode="board"
        districtsBySquare={districtsBySquare}
        showCoordinates={false}
        showDistrictLabels={false}
        showActiveSquareLabel
        showPieces={false}
        onSquareClick={(square) => {
          if (selectedDistrict) {
            onSquareChange(square);
            return;
          }

          const district = districtsBySquare.get(square);
          if (district) {
            onSelectDistrict(district.id);
          }
        }}
        onSquareHover={(square) => onHoveredSquareChange(square)}
        onSquareLeave={() => onHoveredSquareChange(null)}
      />
    </div>
  );
}

export function CityDistrictMapEditor({
  cityBoard,
  selectedDistrict,
  highlightedDistrict,
  locationSearchRequest,
  onMapAnchorChange,
  onHighlightedDistrictChange,
  onSelectDistrict,
  importModeArmed,
  onImportModeConsumed
}: CityDistrictMapEditorProps) {
  const [viewMode, setViewMode] = useState<MapViewMode>("map");
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);
  const hasHydratedCamera = useRef(false);
  const lastCameraDistrictIdRef = useRef<string | null>(selectedDistrict?.id ?? null);
  const markerBounds = useMemo(() => getCityBoardMarkerBounds(cityBoard), [cityBoard]);
  const districtsBySquare = useMemo(
    () => new Map(cityBoard.districts.map((district) => [district.square, district] as const)),
    [cityBoard.districts]
  );
  const selectedDistrictRef = useRef<DistrictCell | null>(selectedDistrict);
  const districtsBySquareRef = useRef(districtsBySquare);
  const onMapAnchorChangeRef = useRef(onMapAnchorChange);
  const onHighlightedDistrictChangeRef = useRef(onHighlightedDistrictChange);
  const onSelectDistrictRef = useRef(onSelectDistrict);
  const importModeArmedRef = useRef(importModeArmed);
  const onImportModeConsumedRef = useRef(onImportModeConsumed);
  const activeDistrict = highlightedDistrict ?? selectedDistrict ?? null;
  const cameraCenter = useMemo(
    () =>
      selectedDistrict
        ? getDistrictMapCenter(cityBoard, selectedDistrict)
        : [
            (markerBounds[0][0] + markerBounds[1][0]) / 2,
            (markerBounds[0][1] + markerBounds[1][1]) / 2
          ] as [number, number],
    [cityBoard, markerBounds, selectedDistrict]
  );
  const openUrl = useMemo(
    () =>
      buildOpenStreetMapUrl(
        selectedDistrict ? cameraCenter : getDistrictMapCenter(cityBoard, activeDistrict ?? cityBoard.districts[0]!),
        selectedDistrict?.mapAnchor ? 14 : 12
      ),
    [activeDistrict, cameraCenter, cityBoard, selectedDistrict]
  );

  useEffect(() => {
    selectedDistrictRef.current = selectedDistrict;
    districtsBySquareRef.current = districtsBySquare;
    onMapAnchorChangeRef.current = onMapAnchorChange;
    onHighlightedDistrictChangeRef.current = onHighlightedDistrictChange;
    onSelectDistrictRef.current = onSelectDistrict;
    importModeArmedRef.current = importModeArmed;
    onImportModeConsumedRef.current = onImportModeConsumed;
  }, [
    districtsBySquare,
    importModeArmed,
    onHighlightedDistrictChange,
    onImportModeConsumed,
    onMapAnchorChange,
    onSelectDistrict,
    selectedDistrict
  ]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: createMapLibreRasterStyle(viewMode),
      center: cameraCenter,
      zoom: selectedDistrict?.mapAnchor ? 13.75 : 11.5,
      attributionControl: {}
    });

    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.getCanvas().style.cursor = "crosshair";
    map.on("load", () => {
      syncDistrictMarkerLayers(map, cityBoard, activeDistrict);
    });
    map.on("click", (event) => {
      const markerFeature = map
        .queryRenderedFeatures(event.point, {
          layers: [markerLayerId, markerActiveLayerId]
        })
        .find((feature) => typeof feature.properties?.square === "string");

      const markerSquare =
        typeof markerFeature?.properties?.square === "string"
          ? (markerFeature.properties.square as Square)
          : null;

      if (markerSquare) {
        const district = districtsBySquareRef.current.get(markerSquare);
        if (district) {
          onSelectDistrictRef.current(district.id);
          return;
        }
      }

      if (!selectedDistrictRef.current || !importModeArmedRef.current) {
        return;
      }

      onMapAnchorChangeRef.current({
        longitude: Number(event.lngLat.lng.toFixed(6)),
        latitude: Number(event.lngLat.lat.toFixed(6))
      });
      onImportModeConsumedRef.current();
    });
    map.on("mousemove", markerLayerId, (event) => {
      map.getCanvas().style.cursor = "pointer";
      const markerSquare =
        typeof event.features?.[0]?.properties?.square === "string"
          ? (event.features[0].properties.square as string)
          : null;
      const district = markerSquare ? districtsBySquareRef.current.get(markerSquare as Square) ?? null : null;
      onHighlightedDistrictChangeRef.current(district?.id ?? null);
    });
    map.on("mousemove", markerActiveLayerId, (event) => {
      map.getCanvas().style.cursor = "pointer";
      const markerSquare =
        typeof event.features?.[0]?.properties?.square === "string"
          ? (event.features[0].properties.square as string)
          : null;
      const district = markerSquare ? districtsBySquareRef.current.get(markerSquare as Square) ?? null : null;
      onHighlightedDistrictChangeRef.current(district?.id ?? null);
    });
    map.on("mouseleave", markerLayerId, () => {
      map.getCanvas().style.cursor = "crosshair";
      onHighlightedDistrictChangeRef.current(null);
    });
    map.on("mouseleave", markerActiveLayerId, () => {
      map.getCanvas().style.cursor = "crosshair";
      onHighlightedDistrictChangeRef.current(null);
    });
    mapRef.current = map;
    hasHydratedCamera.current = false;

    return () => {
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;
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
      syncDistrictMarkerLayers(map, cityBoard, activeDistrict);
      map.resize();
    });
  }, [activeDistrict, cityBoard, viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    syncDistrictMarkerLayers(map, cityBoard, activeDistrict);
  }, [activeDistrict, cityBoard, selectedDistrict?.mapAnchor]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!hasHydratedCamera.current) {
      if (selectedDistrict?.mapAnchor) {
        map.jumpTo({
          center: cameraCenter,
          zoom: 13.75
        });
      } else {
        map.fitBounds(markerBounds, {
          padding: 36,
          duration: 0,
          maxZoom: 12
        });
      }
      hasHydratedCamera.current = true;
      return;
    }

    const selectedDistrictId = selectedDistrict?.id ?? null;
    const previousCameraDistrictId = lastCameraDistrictIdRef.current;
    const hasSelectionChanged = previousCameraDistrictId !== selectedDistrictId;
    lastCameraDistrictIdRef.current = selectedDistrictId;

    if (selectedDistrict) {
      if (hasSelectionChanged) {
        map.stop();
        map.flyTo({
          center: cameraCenter,
          zoom: selectedDistrict.mapAnchor ? 13.75 : 12,
          duration: 1000,
          essential: true,
          curve: 0.5,
          speed: 1
        });
        return;
      }

      const currentBounds = map.getBounds();
      const radiusBounds = getDistrictRadiusBounds(cityBoard, selectedDistrict);
      const mapCanvas = map.getCanvas();
      const centerPoint = map.project(cameraCenter);
      const edgePadding = 48;
      const isCenterVisible =
        currentBounds.contains(cameraCenter) &&
        centerPoint.x >= edgePadding &&
        centerPoint.x <= mapCanvas.clientWidth - edgePadding &&
        centerPoint.y >= edgePadding &&
        centerPoint.y <= mapCanvas.clientHeight - edgePadding;
      const isRadiusVisible =
        currentBounds.contains(radiusBounds.getSouthWest()) &&
        currentBounds.contains(radiusBounds.getNorthEast());

      if (!isCenterVisible) {
        map.panTo(cameraCenter, {
          duration: 120,
          essential: true
        });
        return;
      }

      if (!isRadiusVisible) {
        map.fitBounds(radiusBounds, {
          padding: 36,
          duration: 250,
          essential: true,
          maxZoom: 13.75
        });
      }
      return;
    }

    map.stop();
    map.fitBounds(markerBounds, {
      padding: 36,
      duration: 500,
      maxZoom: 12
    });
  }, [cameraCenter, cityBoard, markerBounds, selectedDistrict]);

  useEffect(() => {
    if (!locationSearchRequest) {
      return;
    }

    const map = mapRef.current;
    if (!map) {
      return;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const searchResult = await searchLocationByName({
          query: locationSearchRequest.query,
          viewbox: markerBounds,
          signal: controller.signal
        });
        if (!searchResult || controller.signal.aborted) {
          return;
        }

        const markerElement = searchMarkerRef.current?.getElement() ?? document.createElement("div");
        markerElement.className = "city-placement-editor__search-marker";

        if (!searchMarkerRef.current) {
          searchMarkerRef.current = new maplibregl.Marker({
            element: markerElement,
            anchor: "center"
          }).addTo(map);
        }

        searchMarkerRef.current.setLngLat(searchResult.center);

        const selectedCenter = selectedDistrict ? getDistrictMapCenter(cityBoard, selectedDistrict) : null;
        map.stop();

        if (selectedCenter) {
          const bounds = new maplibregl.LngLatBounds(selectedCenter, selectedCenter);
          bounds.extend(searchResult.center);
          map.fitBounds(bounds, {
            padding: 64,
            duration: 1000,
            essential: true,
            maxZoom: 14
          });
          return;
        }

        map.flyTo({
          center: searchResult.center,
          zoom: 14,
          duration: 1000,
          essential: true,
          curve: 0.5,
          speed: 1
        });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Unable to find location on map", error);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [cityBoard, locationSearchRequest, markerBounds, selectedDistrict]);

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
    <div className="city-placement-editor__map">
      <div className="city-placement-editor__toolbar">
        <div className="city-placement-editor__toggle-group" role="group" aria-label="Map imagery">
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
        <div className="city-placement-editor__toolbar-actions">
          {selectedDistrict?.mapAnchor ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onMapAnchorChange(undefined)}
            >
              <MapPinOff />
              Clear anchor
            </Button>
          ) : null}
          <Button asChild type="button" size="sm" variant="outline">
            <a href={openUrl} target="_blank" rel="noreferrer">
              Source
              <ExternalLink />
            </a>
          </Button>
        </div>
      </div>

      <div className="city-placement-editor__map-frame">
        <div ref={mapContainerRef} className="city-placement-editor__map-canvas" />
      </div>
    </div>
  );
}
