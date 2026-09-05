/**
 * @deprecated Use AppMapView — kept as a thin adapter so old imports keep working.
 * Android uses MapLibre/OSM; iOS uses Apple Maps via AppMapView.
 */
import React, { useMemo } from "react";

import type { Bus, Stop } from "../types";
import { AppMapView, type AppMapMarker, type AppMapRegion } from "./AppMapView";
import { StatusBadge } from "./StatusBadge";

type Props = {
  buses: Bus[];
  stops?: Stop[];
  initialRegion?: AppMapRegion;
  showBadges?: boolean;
};

export function BusMapView({ buses, stops = [], initialRegion, showBadges = true }: Props) {
  const markers = useMemo(() => {
    const list: AppMapMarker[] = [];
    for (const s of stops) {
      list.push({
        id: s.stop_id,
        lat: s.lat,
        lng: s.lng,
        title: s.name,
        type: "stop",
      });
    }
    for (const bus of buses) {
      if (bus.current_lat == null || bus.current_lng == null) continue;
      list.push({
        id: bus.id,
        lat: bus.current_lat,
        lng: bus.current_lng,
        title: bus.bus_number,
        type: "bus",
        color: bus.is_stale || bus.status === "signal_lost" ? "#C46A1B" : "#1B7F4E",
      });
    }
    return list;
  }, [buses, stops]);

  const firstBus = buses.find((b) => b.current_lat != null && b.current_lng != null);
  const region: AppMapRegion | undefined =
    initialRegion ||
    (firstBus
      ? {
          latitude: firstBus.current_lat!,
          longitude: firstBus.current_lng!,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }
      : undefined);

  return (
    <AppMapView markers={markers} initialRegion={region}>
      {showBadges
        ? buses.map((bus) => (
            <StatusBadge
              key={bus.id}
              isStale={bus.is_stale || bus.status === "signal_lost"}
              lastUpdatedAt={bus.last_updated_at}
              status={bus.status}
            />
          ))
        : null}
    </AppMapView>
  );
}
