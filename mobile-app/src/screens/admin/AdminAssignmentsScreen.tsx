import React, { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../services/api";
import type { Bus, Route, User } from "../../types";

export function AdminAssignmentsScreen() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    const [b, d, r] = await Promise.all([api.listBuses(), api.listDrivers(), api.adminRoutes()]);
    setBuses(b);
    setDrivers(d);
    setRoutes(r);
  };

  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, []);

  const assign = async (bus: Bus, driverId: string | null, routeId: string | null) => {
    try {
      await api.assignBus(bus.id, { driver_id: driverId, route_id: routeId });
      setMessage(`Updated ${bus.bus_number}`);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Assign failed");
    }
  };

  const driverName = (id?: string | null) => drivers.find((d) => d.id === id)?.name || "Unassigned";
  const routeName = (id?: string | null) => routes.find((r) => r.id === id)?.name || "Unassigned";

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>Tap a driver or route under each bus to assign it.</Text>
      {message ? <Text style={styles.msg}>{message}</Text> : null}
      <FlatList
        data={buses}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.bus_number}</Text>
            <Text style={styles.meta}>Driver: {driverName(item.driver_id)}</Text>
            <Text style={styles.meta}>Route: {routeName(item.route_id)}</Text>
            <Text style={styles.section}>Set driver</Text>
            {drivers.map((d) => (
              <Pressable
                key={d.id}
                style={[styles.chip, item.driver_id === d.id && styles.chipActive]}
                onPress={() => assign(item, d.id, item.route_id || null)}
              >
                <Text style={[styles.chipText, item.driver_id === d.id && styles.chipTextActive]}>
                  {d.name}
                </Text>
              </Pressable>
            ))}
            <Text style={styles.section}>Set route</Text>
            {routes.map((r) => (
              <Pressable
                key={r.id}
                style={[styles.chip, item.route_id === r.id && styles.chipActive]}
                onPress={() => assign(item, item.driver_id || null, r.id)}
              >
                <Text style={[styles.chipText, item.route_id === r.id && styles.chipTextActive]}>
                  {r.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#F3F6F8" },
  intro: { color: "#5A6A7A", marginBottom: 8 },
  msg: { color: "#1B7F4E", marginBottom: 8, fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8EE",
    gap: 4,
  },
  cardTitle: { fontWeight: "700", fontSize: 18, color: "#152433" },
  meta: { color: "#5A6A7A" },
  section: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    color: "#1C4E7A",
    textTransform: "uppercase",
  },
  chip: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F6",
  },
  chipActive: { backgroundColor: "#E8F1F8" },
  chipText: { color: "#152433" },
  chipTextActive: { color: "#1C4E7A", fontWeight: "700" },
});
