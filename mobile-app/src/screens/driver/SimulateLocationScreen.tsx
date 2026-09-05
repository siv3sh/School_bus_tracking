import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppMapView, regionFromCoords, type AppMapMarker, type LatLng } from "../../components/AppMapView";
import { useNetwork } from "../../context/NetworkContext";
import { useSockets } from "../../context/SocketContext";
import { api } from "../../services/api";
import { setLocationPublishDeps } from "../../services/locationService";
import type { Bus, Stop } from "../../types";

/**
 * Dev mode: drag / tap / jump along route stops to fake GPS without driving.
 */
export function SimulateLocationScreen() {
  const { isOnline } = useNetwork();
  const { openDriverSocket } = useSockets();
  const [bus, setBus] = useState<Bus | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [coord, setCoord] = useState({ latitude: 12.9716, longitude: 77.5946 });
  const [mapReady, setMapReady] = useState(false);
  const [tripReady, setTripReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("Loading route stops…");

  useEffect(() => {
    (async () => {
      const data = await api.myBus();
      setBus(data.bus);
      const routeStops = [...(data.route?.stops || [])].sort(
        (a, b) => a.sequence_number - b.sequence_number,
      );
      setStops(routeStops);
      // Always start on the demo route — not the driver's real GPS (often far away)
      const start = routeStops[0];
      if (start) {
        setCoord({ latitude: start.lat, longitude: start.lng });
      } else if (data.bus.current_lat != null && data.bus.current_lng != null) {
        setCoord({ latitude: data.bus.current_lat, longitude: data.bus.current_lng });
      }
      setMapReady(true);
      setHint(
        routeStops.length
          ? "Stops are on the map. Prepare trip, then drag the green DRAG pin (or tap the map / a stop)."
          : "No stops on this route — tap the map to place the bus pin.",
      );
    })().catch(() => setHint("Could not load bus/route — check API connection."));
  }, []);

  const routeCoords = useMemo<LatLng[]>(
    () => stops.map((s) => ({ latitude: s.lat, longitude: s.lng })),
    [stops],
  );

  const markers = useMemo<AppMapMarker[]>(() => {
    const list: AppMapMarker[] = stops.map((s) => ({
      id: s.stop_id,
      lat: s.lat,
      lng: s.lng,
      title: s.name,
      type: "stop",
      prominent: true,
      color: "#2F5D8C",
    }));
    list.push({
      id: "sim-bus",
      lat: coord.latitude,
      lng: coord.longitude,
      title: "Simulated bus",
      type: "bus",
      draggable: true,
      prominent: true,
      color: "#1B7F4E",
    });
    return list;
  }, [stops, coord.latitude, coord.longitude]);

  const mapRegion = useMemo(
    () =>
      regionFromCoords(
        stops.length
          ? stops.map((s) => ({ latitude: s.lat, longitude: s.lng }))
          : [{ latitude: coord.latitude, longitude: coord.longitude }],
      ),
    [stops, coord.latitude, coord.longitude],
  );

  const ensureTrip = async () => {
    if (!bus) return;
    setBusy(true);
    try {
      if (!bus.trip_active) {
        await api.startTrip(bus.id);
        setBus({ ...bus, trip_active: true });
      }
      const sock = openDriverSocket(bus.id);
      setLocationPublishDeps({ isOnline, socket: sock });
      setTripReady(true);
      setHint("Ready — drag green pin, tap map, or tap a stop name below, then Send.");
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Could not start trip");
    } finally {
      setBusy(false);
    }
  };

  const push = async (latitude: number, longitude: number) => {
    if (!bus || !tripReady) {
      setHint("Tap “Prepare trip” first, then send points.");
      return;
    }
    setBusy(true);
    try {
      // REST-only for simulate — avoids driver WS + MapLibre fighting on the same tick
      await api.postLatestLocation({
        bus_id: bus.id,
        lat: latitude,
        lng: longitude,
        speed: 8,
        recorded_at: new Date().toISOString(),
      });
      setHint(`Sent ${latitude.toFixed(4)}, ${longitude.toFixed(4)} — check parent Track.`);
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  };

  if (!mapReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#1C4E7A" />
        <Text style={styles.sub}>{hint}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sub}>{hint}</Text>
      <Pressable style={styles.btn} onPress={ensureTrip} disabled={busy}>
        <Text style={styles.btnText}>
          {tripReady ? "Trip socket ready ✓" : "1. Prepare trip + socket"}
        </Text>
      </Pressable>

      {/* Remount map once route is known so camera fits stops */}
      <AppMapView
        key={`sim-${stops.map((s) => s.stop_id).join("-") || "empty"}`}
        style={styles.map}
        initialRegion={mapRegion}
        cameraMode="overview"
        markers={markers}
        routeCoords={routeCoords}
        onMarkerDragEnd={(id, lat, lng) => {
          if (id !== "sim-bus") return;
          setCoord({ latitude: lat, longitude: lng });
          setHint("Pin moved — tap Send current point.");
        }}
        onMapPress={(lat, lng) => {
          setCoord({ latitude: lat, longitude: lng });
          setHint("Map tapped — pin moved. Tap Send to publish.");
        }}
      />

      {stops.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stopRow}>
          {stops.map((s) => (
            <Pressable
              key={s.stop_id}
              style={styles.stopChip}
              onPress={() => {
                setCoord({ latitude: s.lat, longitude: s.lng });
                setHint(`Jumped to ${s.name} — tap Send to publish.`);
              }}
            >
              <Text style={styles.stopChipText}>
                {s.sequence_number}. {s.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <Pressable
        style={[styles.btn, (!tripReady || busy) && styles.btnDisabled]}
        onPress={() => push(coord.latitude, coord.longitude)}
        disabled={!tripReady || busy}
      >
        <Text style={styles.btnText}>2. Send current point</Text>
      </Pressable>
      <Text style={styles.coord}>
        {coord.latitude.toFixed(5)}, {coord.longitude.toFixed(5)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F6F8", padding: 12, gap: 8 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#F3F6F8" },
  sub: { color: "#5A6A7A", marginBottom: 2, lineHeight: 18 },
  map: { flex: 1, minHeight: 280, borderWidth: 1, borderColor: "#C9D2DC" },
  btn: { backgroundColor: "#1C4E7A", padding: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700" },
  stopRow: { flexGrow: 0, maxHeight: 44 },
  stopChip: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#2F5D8C",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
  },
  stopChipText: { color: "#2F5D8C", fontWeight: "700", fontSize: 13 },
  coord: { color: "#8A96A3", fontSize: 12, textAlign: "center" },
});
