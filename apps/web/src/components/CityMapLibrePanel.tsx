import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ExternalLink, Map, Satellite } from "lucide-react";
import type { CityBoard, DistrictCell, MoveRecord } from "@narrative-chess/content-schema";
import { Button } from "@/components/ui/button";
import {
  buildOpenStreetMapUrl,
  createMapLibreRasterStyle,
  getActiveCityMapLocation,
  type MapViewMode
} from "./cityMapShared";

type CityMapLibrePanelProps = {
  cityBoard: CityBoard;
  hoveredDistrict: DistrictCell | null;
  lastMoveDistrict: DistrictCell | null;
  lastMove: MoveRecord | null;
};

export function CityMapLibrePanel({
  cityBoard,
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
        hoveredDistrict,
        lastMoveDistrict,
        lastMove
      }),
    [cityBoard, hoveredDistrict, lastMove, lastMoveDistrict]
  );
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
    mapRef.current = map;
    hasHydratedCamera.current = false;

    return () => {
      map.remove();
      mapRef.current = null;
      hasHydratedCamera.current = false;
    };
  }, [activeLocation.center, activeLocation.zoom, viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.setStyle(createMapLibreRasterStyle(viewMode));
    map.once("styledata", () => {
      map.resize();
    });
  }, [viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!hasHydratedCamera.current) {
      map.jumpTo({
        center: activeLocation.center,
        zoom: activeLocation.zoom
      });
      hasHydratedCamera.current = true;
      return;
    }

    map.flyTo({
      center: activeLocation.center,
      zoom: activeLocation.zoom,
      duration: 1100,
      essential: true,
      curve: 1.2,
      speed: 0.85
    });
  }, [activeLocation.center, activeLocation.zoom]);

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
            <Map />
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
