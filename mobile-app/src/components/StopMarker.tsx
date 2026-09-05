import React from "react";
import { Marker } from "react-native-maps";

import type { Stop } from "../types";

export function StopMarker({ stop }: { stop: Stop }) {
  return (
    <Marker
      coordinate={{ latitude: stop.lat, longitude: stop.lng }}
      title={stop.name}
      description={`Stop #${stop.sequence_number}`}
      pinColor="#2F5D8C"
    />
  );
}
