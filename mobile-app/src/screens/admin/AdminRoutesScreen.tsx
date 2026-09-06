import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppMapView, regionFromCoords, type AppMapMarker, type LatLng } from "../../components/AppMapView";
import { api } from "../../services/api";
import type { Route, Stop } from "../../types";

type Schedule = NonNullable<Route["schedule"]>;

const SCHEDULES: Schedule[] = ["morning", "evening", "both"];
const DEFAULT_PIN = { latitude: 12.9716, longitude: 77.5946 };

/**
 * Build routes by tapping the map to place each stop, then naming and saving.
 */
export function AdminRoutesScreen() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [name, setName] = useState("New Route");
  const [schedule, setSchedule] = useState<Schedule>("morning");
  const [stopName, setStopName] = useState("");
  const [draftPin, setDraftPin] = useState(DEFAULT_PIN);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Route | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [message, setMessage] = useState("");
  const [mapEpoch, setMapEpoch] = useState(0);

  const refresh = () => api.adminRoutes().then(setRoutes).catch((e) => setMessage(e.message));

  useEffect(() => {
    refresh();
  }, []);

  const sortedStops = useMemo(
    () => [...stops].sort((a, b) => a.sequence_number - b.sequence_number),
    [stops],
  );

  const routeCoords: LatLng[] = useMemo(
    () => sortedStops.map((s) => ({ latitude: s.lat, longitude: s.lng })),
    [sortedStops],
  );

  const markers: AppMapMarker[] = useMemo(() => {
    const list: AppMapMarker[] = sortedStops.map((s) => ({
      id: s.stop_id,
      lat: s.lat,
      lng: s.lng,
      title: `${s.sequence_number}. ${s.name}`,
      type: "stop",
      color: s.stop_id === selectedStopId ? "#C46A1B" : "#2F5D8C",
    }));
    list.push({
      id: "draft-pin",
      lat: draftPin.latitude,
      lng: draftPin.longitude,
      title: "New stop",
      type: "bus",
      color: "#1B7F4E",
      prominent: true,
      draggable: true,
    });
    return list;
  }, [sortedStops, draftPin, selectedStopId]);

  const mapRegion = useMemo(() => {
    const coords = [
      ...routeCoords,
      { latitude: draftPin.latitude, longitude: draftPin.longitude },
    ];
    return regionFromCoords(coords, 1.5);
  }, [routeCoords, draftPin]);

  const addStopAtPin = () => {
    const label = stopName.trim() || `Stop ${stops.length + 1}`;
    const next: Stop = {
      stop_id: `tmp-${Date.now()}`,
      name: label,
      lat: draftPin.latitude,
      lng: draftPin.longitude,
      sequence_number: stops.length + 1,
    };
    setStops((s) => [...s, next]);
    setSelectedStopId(next.stop_id);
    setStopName("");
    setMessage(`Added “${label}” — tap map for the next stop.`);
  };

  const removeStop = (stopId: string) => {
    setStops((prev) =>
      prev
        .filter((s) => s.stop_id !== stopId)
        .map((s, i) => ({ ...s, sequence_number: i + 1 })),
    );
    if (selectedStopId === stopId) setSelectedStopId(null);
  };

  const selectStop = (stop: Stop) => {
    setSelectedStopId(stop.stop_id);
    setStopName(stop.name);
    setDraftPin({ latitude: stop.lat, longitude: stop.lng });
    setMapEpoch((n) => n + 1);
  };

  const updateSelectedStop = () => {
    if (!selectedStopId) {
      addStopAtPin();
      return;
    }
    const label = stopName.trim();
    setStops((prev) =>
      prev.map((s) =>
        s.stop_id === selectedStopId
          ? {
              ...s,
              name: label || s.name,
              lat: draftPin.latitude,
              lng: draftPin.longitude,
            }
          : s,
      ),
    );
    setMessage("Stop updated.");
  };

  const resetDraft = () => {
    setEditing(null);
    setStops([]);
    setName("New Route");
    setSchedule("morning");
    setStopName("");
    setSelectedStopId(null);
    setDraftPin(DEFAULT_PIN);
    setMapEpoch((n) => n + 1);
  };

  const save = async () => {
    if (stops.length < 2) {
      setMessage("Add at least 2 stops (tap map → Add stop).");
      return;
    }
    try {
      if (editing) {
        await api.updateRoute(editing.id, { name, stops: sortedStops, schedule });
      } else {
        await api.createRoute({ name, stops: sortedStops, schedule });
      }
      resetDraft();
      await refresh();
      setMessage("Route saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Tap the map to place the green pin, name the stop, then add it. Repeat for each stop in order.
        </Text>
        {message ? <Text style={styles.msg}>{message}</Text> : null}

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Route name"
          placeholderTextColor="#8A96A3"
        />

        <Text style={styles.label}>Schedule</Text>
        <View style={styles.chipRow}>
          {SCHEDULES.map((s) => {
            const active = schedule === s;
            return (
              <Pressable
                key={s}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSchedule(s)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Stop map</Text>
        <Text style={styles.hint}>
          Green pin = new / editing position · Blue = saved stops · Orange = selected
        </Text>
        <View style={styles.mapBox}>
          <AppMapView
            key={`admin-route-${mapEpoch}`}
            style={StyleSheet.absoluteFill}
            initialRegion={mapRegion}
            cameraMode="overview"
            markers={markers}
            routeCoords={routeCoords}
            onMapPress={(lat, lng) => {
              setDraftPin({ latitude: lat, longitude: lng });
              setMessage(`Pin at ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
            }}
            onMarkerDragEnd={(id, lat, lng) => {
              if (id !== "draft-pin") return;
              setDraftPin({ latitude: lat, longitude: lng });
            }}
          />
        </View>

        <TextInput
          style={styles.input}
          value={stopName}
          onChangeText={setStopName}
          placeholder={selectedStopId ? "Rename selected stop" : "Stop name (e.g. Maple Avenue)"}
          placeholderTextColor="#8A96A3"
        />
        <Text style={styles.coord}>
          Pin {draftPin.latitude.toFixed(5)}, {draftPin.longitude.toFixed(5)}
        </Text>

        <View style={styles.row}>
          <Pressable style={[styles.secondaryBtn, styles.flex]} onPress={addStopAtPin}>
            <Text style={styles.secondaryBtnText}>Add stop here</Text>
          </Pressable>
          {selectedStopId ? (
            <Pressable style={[styles.secondaryBtn, styles.flex]} onPress={updateSelectedStop}>
              <Text style={styles.secondaryBtnText}>Update selected</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.label}>Stops in order ({sortedStops.length})</Text>
        {sortedStops.length === 0 ? (
          <Text style={styles.sub}>No stops yet — tap the map, then Add stop here.</Text>
        ) : (
          sortedStops.map((s) => {
            const active = s.stop_id === selectedStopId;
            return (
              <View key={s.stop_id} style={[styles.stopRow, active && styles.stopRowActive]}>
                <Pressable style={styles.stopMain} onPress={() => selectStop(s)}>
                  <Text style={styles.stopIndex}>{s.sequence_number}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stopName}>{s.name}</Text>
                    <Text style={styles.stopMeta}>
                      {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                    </Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => removeStop(s.stop_id)} hitSlop={8}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            );
          })
        )}

        <Pressable style={styles.btn} onPress={save}>
          <Text style={styles.btnText}>{editing ? "Save route changes" : "Create route"}</Text>
        </Pressable>
        {editing ? (
          <Pressable style={styles.ghostBtn} onPress={resetDraft}>
            <Text style={styles.ghostBtnText}>Cancel edit</Text>
          </Pressable>
        ) : null}

        <Text style={styles.listTitle}>Existing routes</Text>
        {routes.map((item) => (
          <Pressable
            key={item.id}
            style={styles.card}
            onPress={() => {
              setEditing(item);
              setName(item.name);
              setSchedule(item.schedule ?? "morning");
              setStops(item.stops);
              const first = [...item.stops].sort((a, b) => a.sequence_number - b.sequence_number)[0];
              if (first) {
                setDraftPin({ latitude: first.lat, longitude: first.lng });
                setSelectedStopId(first.stop_id);
                setStopName(first.name);
              }
              setMapEpoch((n) => n + 1);
              setMessage(`Editing “${item.name}”`);
            }}
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.meta}>
              {(item.schedule ?? "morning").toUpperCase()} ·{" "}
              {item.stops.map((s) => s.name).join(" → ") || "No stops"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F6F8" },
  scroll: { padding: 16, paddingBottom: 40, gap: 8 },
  intro: { color: "#5A6A7A", lineHeight: 20, marginBottom: 4 },
  msg: { color: "#1B7F4E", fontWeight: "600" },
  label: { color: "#5A6A7A", fontWeight: "700", marginTop: 8, textTransform: "uppercase", fontSize: 12 },
  hint: { color: "#8A96A3", fontSize: 12, marginBottom: 4 },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    borderWidth: 1,
    borderColor: "#C9D2DC",
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipActive: { borderColor: "#1C4E7A", backgroundColor: "#E8F1F8" },
  chipText: { color: "#5A6A7A", fontWeight: "600" },
  chipTextActive: { color: "#1C4E7A" },
  input: {
    borderWidth: 1,
    borderColor: "#C9D2DC",
    backgroundColor: "#fff",
    padding: 12,
    color: "#1C2B3A",
    fontSize: 16,
  },
  mapBox: {
    height: 260,
    borderWidth: 1,
    borderColor: "#C9D2DC",
    backgroundColor: "#DCE3EA",
    overflow: "hidden",
  },
  coord: { color: "#8A96A3", fontSize: 12 },
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
  btn: { backgroundColor: "#1C4E7A", padding: 14, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#1C4E7A",
    padding: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  secondaryBtnText: { color: "#1C4E7A", fontWeight: "700" },
  ghostBtn: { padding: 12, alignItems: "center" },
  ghostBtnText: { color: "#5A6A7A", fontWeight: "600" },
  sub: { color: "#5A6A7A" },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8EE",
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  stopRowActive: { borderColor: "#C46A1B", backgroundColor: "#FFF8F0" },
  stopMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  stopIndex: {
    width: 28,
    height: 28,
    textAlign: "center",
    textAlignVertical: "center",
    lineHeight: 28,
    backgroundColor: "#E8F1F8",
    color: "#1C4E7A",
    fontWeight: "800",
    overflow: "hidden",
  },
  stopName: { fontWeight: "700", color: "#152433" },
  stopMeta: { color: "#8A96A3", fontSize: 12, marginTop: 2 },
  remove: { color: "#A32020", fontWeight: "600", fontSize: 13 },
  listTitle: { fontWeight: "700", color: "#152433", marginTop: 16, marginBottom: 4 },
  card: { backgroundColor: "#fff", padding: 12, marginTop: 8, borderWidth: 1, borderColor: "#E2E8EE" },
  cardTitle: { fontWeight: "700", color: "#152433" },
  meta: { color: "#5A6A7A", marginTop: 4 },
});
