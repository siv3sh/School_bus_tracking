"use client";

import { LngLatBounds, Map, Marker, NavigationControl, Popup, type StyleSpecification } from "maplibre-gl";
import { useEffect, useRef } from "react";

import type { BusPublic } from "@/lib/api/types";
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

function markerColor(bus: BusPublic): string {
  if (bus.trip_active && !bus.is_stale) return "#16a34a";
  if (bus.trip_active && bus.is_stale) return "#d97706";
  return "#71717a";
}

export function MapView({ buses }: { buses: BusPublic[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [77.5946, 12.9716],
      zoom: 11,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    const bounds = new LngLatBounds();
    let hasPoint = false;
    for (const bus of buses) {
      if (bus.current_lng == null || bus.current_lat == null) continue;
      hasPoint = true;
      bounds.extend([bus.current_lng, bus.current_lat]);
      const el = document.createElement("div");
      el.className = "size-3 rounded-full border-2 border-white shadow";
      el.style.background = markerColor(bus);
      const marker = new Marker({ element: el })
        .setLngLat([bus.current_lng, bus.current_lat])
        .setPopup(
          new Popup({ offset: 12 }).setHTML(
            `<strong>${bus.bus_number}</strong><br/>${
              bus.trip_active ? (bus.is_stale ? "Offline (stale GPS)" : "Live") : "Idle"
            }`,
          ),
        )
        .addTo(map);
      markersRef.current.push(marker);
    }
    if (hasPoint) {
      map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 400 });
    }
  }, [buses]);

  return <div ref={containerRef} className="h-full min-h-[420px] w-full overflow-hidden rounded-xl border" />;
}
