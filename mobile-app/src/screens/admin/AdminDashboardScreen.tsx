import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppMapView, regionFromCoords, type AppMapMarker } from "../../components/AppMapView";
import { useAuth } from "../../context/AuthContext";
import { useSockets } from "../../context/SocketContext";
import { api } from "../../services/api";
import type { Bus } from "../../types";

function busTone(bus: Bus): "live" | "warn" | "idle" {
  if (bus.status === "signal_lost" || bus.is_stale) return "warn";
  if (bus.trip_active || bus.status === "active") return "live";
  return "idle";
}

function busLabel(bus: Bus): string {
  const tone = busTone(bus);
  if (tone === "live") return "Live";
  if (tone === "warn") return "Signal lost / stale";
  return "Idle";
}

export function AdminDashboardScreen() {
  const { user } = useAuth();
  const { subscribeAdmin } = useSockets();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setBuses(await api.listBuses());
    } catch {
      // keep previous
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return subscribeAdmin((payload) => {
      const msg = payload as { bus?: Bus };
      if (!msg.bus) return;
      setBuses((prev) => {
        const idx = prev.findIndex((b) => b.id === msg.bus!.id);
        if (idx === -1) return [...prev, msg.bus!];
        const next = [...prev];
        next[idx] = msg.bus!;
        return next;
      });
    });
  }, [subscribeAdmin]);

  const markers = useMemo(() => {
    const list: AppMapMarker[] = [];
    for (const bus of buses) {
      if (bus.current_lat == null || bus.current_lng == null) continue;
      list.push({
        id: bus.id,
        lat: bus.current_lat,
        lng: bus.current_lng,
        title: bus.bus_number,
        type: "bus",
        color: busTone(bus) === "live" ? "#1B7F4E" : busTone(bus) === "warn" ? "#C46A1B" : "#8A96A3",
      });
    }
    return list;
  }, [buses]);

  const liveCount = buses.filter((b) => busTone(b) === "live").length;
  const warnCount = buses.filter((b) => busTone(b) === "warn").length;
  const initialRegion = useMemo(
    () => regionFromCoords(markers.map((m) => ({ latitude: m.lat, longitude: m.lng }))),
    [markers],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor="#1C4E7A"
          />
        }
      >
        <Text style={styles.greeting}>Hi{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</Text>
        <Text style={styles.headline}>Fleet overview</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{buses.length}</Text>
            <Text style={styles.statLabel}>Buses</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: "#1B7F4E" }]}>{liveCount}</Text>
            <Text style={styles.statLabel}>Live</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: "#C46A1B" }]}>{warnCount}</Text>
            <Text style={styles.statLabel}>Issues</Text>
          </View>
        </View>

        <View style={styles.mapCard}>
          <Text style={styles.mapTitle}>Live map</Text>
          <View style={styles.mapInner}>
            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator color="#1C4E7A" />
              </View>
            ) : (
              <AppMapView markers={markers} initialRegion={initialRegion} cameraMode="overview" />
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Buses</Text>
        {buses.length === 0 ? (
          <Text style={styles.muted}>No buses yet. Create assignments under Manage.</Text>
        ) : (
          buses.map((bus) => {
            const tone = busTone(bus);
            return (
              <View key={bus.id} style={styles.busCard}>
                <View
                  style={[
                    styles.dot,
                    tone === "live" ? styles.dotLive : tone === "warn" ? styles.dotWarn : styles.dotIdle,
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.busName}>{bus.bus_number}</Text>
                  <Text style={styles.muted}>
                    {busLabel(bus)}
                    {bus.last_updated_at
                      ? ` · ${new Date(bus.last_updated_at).toLocaleTimeString()}`
                      : ""}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F6F8" },
  scroll: { padding: 20, paddingBottom: 28, gap: 12 },
  greeting: { color: "#5A6A7A", fontSize: 15 },
  headline: { fontSize: 28, fontWeight: "700", color: "#152433" },
  statsRow: { flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8EE",
    padding: 12,
    alignItems: "center",
  },
  statNum: { fontSize: 22, fontWeight: "700", color: "#152433" },
  statLabel: { color: "#6B7A8A", fontSize: 12, marginTop: 2 },
  mapCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8EE",
    overflow: "hidden",
  },
  mapTitle: { padding: 12, fontWeight: "700", color: "#152433" },
  mapInner: { height: 240, overflow: "hidden", zIndex: 0 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  sectionTitle: { fontWeight: "700", color: "#152433", fontSize: 16, marginTop: 4 },
  busCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8EE",
    padding: 14,
    alignItems: "flex-start",
  },
  busName: { fontWeight: "700", color: "#152433", fontSize: 16 },
  muted: { color: "#6B7A8A", fontSize: 13 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  dotLive: { backgroundColor: "#1B7F4E" },
  dotWarn: { backgroundColor: "#C46A1B" },
  dotIdle: { backgroundColor: "#8A96A3" },
});
