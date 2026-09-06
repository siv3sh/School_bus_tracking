"use client";

import { Map, Marker, type StyleSpecification } from "maplibre-gl";
import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export function StopPickerMap({
  lat,
  lng,
  onPick,
}: {
  lat?: number;
  lng?: number;
  onPick: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);

  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [lng ?? 77.5946, lat ?? 12.9716],
      zoom: 12,
    });
    map.on("click", (event) => {
      onPickRef.current(event.lngLat.lat, event.lngLat.lng);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Map is created once; later lat/lng updates move the marker in the second effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat == null || lng == null) return;
    if (!markerRef.current) {
      markerRef.current = new Marker().setLngLat([lng, lat]).addTo(map);
    } else {
      markerRef.current.setLngLat([lng, lat]);
    }
    map.setCenter([lng, lat]);
  }, [lat, lng]);

  return <div ref={containerRef} className="h-56 w-full overflow-hidden rounded-lg border" />;
}
