import React, { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { api } from "../../services/api";
import type { Route, Stop } from "../../types";

type Schedule = NonNullable<Route["schedule"]>;

const SCHEDULES: Schedule[] = ["morning", "evening", "both"];

export function AdminRoutesScreen() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [name, setName] = useState("New Route");
  const [schedule, setSchedule] = useState<Schedule>("morning");
  const [stopName, setStopName] = useState("Stop");
  const [lat, setLat] = useState("12.9716");
  const [lng, setLng] = useState("77.5946");
  const [editing, setEditing] = useState<Route | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [message, setMessage] = useState("");

  const refresh = () => api.adminRoutes().then(setRoutes).catch((e) => setMessage(e.message));

  useEffect(() => {
    refresh();
  }, []);

  const addStop = () => {
    const next: Stop = {
      stop_id: `tmp-${Date.now()}`,
      name: stopName,
      lat: Number(lat),
      lng: Number(lng),
      sequence_number: stops.length + 1,
    };
    setStops((s) => [...s, next]);
  };

  const resetDraft = () => {
    setEditing(null);
    setStops([]);
    setName("New Route");
    setSchedule("morning");
  };

  const save = async () => {
    try {
      if (editing) {
        await api.updateRoute(editing.id, { name, stops, schedule });
      } else {
        await api.createRoute({ name, stops, schedule });
      }
      resetDraft();
      await refresh();
      setMessage("Saved successfully");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>Add stops with lat/lng, then save the route.</Text>
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
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.flex]}
          value={stopName}
          onChangeText={setStopName}
          placeholder="Stop name"
          placeholderTextColor="#8A96A3"
        />
        <TextInput
          style={[styles.input, styles.small]}
          value={lat}
          onChangeText={setLat}
          placeholder="lat"
          placeholderTextColor="#8A96A3"
          keyboardType="decimal-pad"
        />
        <TextInput
          style={[styles.input, styles.small]}
          value={lng}
          onChangeText={setLng}
          placeholder="lng"
          placeholderTextColor="#8A96A3"
          keyboardType="decimal-pad"
        />
      </View>
      <Pressable style={styles.secondaryBtn} onPress={addStop}>
        <Text style={styles.secondaryBtnText}>Add stop to draft</Text>
      </Pressable>
      <Text style={styles.sub}>Draft: {stops.map((s) => s.name).join(" → ") || "none yet"}</Text>
      <Pressable style={styles.btn} onPress={save}>
        <Text style={styles.btnText}>{editing ? "Update route" : "Create route"}</Text>
      </Pressable>
      <FlatList
        data={routes}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={<Text style={styles.listTitle}>Existing routes</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => {
              setEditing(item);
              setName(item.name);
              setSchedule(item.schedule ?? "morning");
              setStops(item.stops);
              setMessage(`Editing “${item.name}”`);
            }}
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.meta}>
              {(item.schedule ?? "morning").toUpperCase()} ·{" "}
              {item.stops.map((s) => s.name).join(" → ") || "No stops"}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#F3F6F8", gap: 8 },
  intro: { color: "#5A6A7A", marginBottom: 4 },
  msg: { color: "#1B7F4E", fontWeight: "600" },
  label: { color: "#5A6A7A", fontWeight: "600", marginTop: 4 },
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
    padding: 10,
    color: "#1C2B3A",
  },
  row: { flexDirection: "row", gap: 6 },
  flex: { flex: 1 },
  small: { width: 80 },
  btn: { backgroundColor: "#1C4E7A", padding: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#1C4E7A",
    padding: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  secondaryBtnText: { color: "#1C4E7A", fontWeight: "700" },
  sub: { color: "#5A6A7A" },
  listTitle: { fontWeight: "700", color: "#152433", marginTop: 8, marginBottom: 4 },
  card: { backgroundColor: "#fff", padding: 12, marginTop: 8, borderWidth: 1, borderColor: "#E2E8EE" },
  cardTitle: { fontWeight: "700", color: "#152433" },
  meta: { color: "#5A6A7A", marginTop: 4 },
});
