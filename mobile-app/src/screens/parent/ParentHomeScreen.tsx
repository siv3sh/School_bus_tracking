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

import { AppMapView, regionFromCoords, type AppMapMarker, type LatLng, type MapCameraMode } from "../../components/AppMapView";
import { useAuth } from "../../context/AuthContext";
import { useSockets } from "../../context/SocketContext";
import { api } from "../../services/api";
import { registerForPushNotifications } from "../../services/notifications";
import type { Bus, ChildBundle, Stop } from "../../types";

function tripHeadline(bus: Bus | null): { label: string; tone: "live" | "warn" | "idle" } {
  if (!bus) return { label: "No bus assigned yet", tone: "idle" };
  if (!bus.trip_active && bus.status === "inactive") {
    return { label: "Trip not started", tone: "idle" };
  }
  if (bus.status === "signal_lost" || bus.is_stale) {
    return { label: "Signal weak — showing last known location", tone: "warn" };
  }
  if (bus.trip_active || bus.status === "active") {
    return { label: "Bus is live on the route", tone: "live" };
  }
  return { label: "Waiting for driver", tone: "idle" };
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km away`;
  return `${Math.round(meters)} m away`;
}

export function ParentHomeScreen() {
  const { user } = useAuth();
  const { subscribeBus } = useSockets();
  const [children, setChildren] = useState<ChildBundle[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [bus, setBus] = useState<Bus | null>(null);
  const [stop, setStop] = useState<Stop | null>(null);
  const [routeName, setRouteName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [cameraMode, setCameraMode] = useState<MapCameraMode>("follow");
  const [mapEpoch, setMapEpoch] = useState(0);
  const [boardBusy, setBoardBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api.parentChildren();
      setChildren(data);
      setSelectedIndex((i) => Math.min(i, Math.max(data.length - 1, 0)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load children");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    registerForPushNotifications().catch(() => undefined);
    load();
  }, [load]);

  // Poll so trip / stop / boarded changes show even if WebSocket drops
  useEffect(() => {
    const id = setInterval(() => {
      load().catch(() => undefined);
    }, 5000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const selected = children[selectedIndex];
    if (!selected) return;
    setBus((prev) => {
      const next = selected.bus;
      if (!next) return null;
      if (!prev) return next;
      if (prev.id !== next.id) return next;
      const prevTs = prev.last_updated_at ? Date.parse(prev.last_updated_at) : 0;
      const nextTs = next.last_updated_at ? Date.parse(next.last_updated_at) : 0;
      // Keep a fresher live socket update if REST is older
      if (prevTs > nextTs) {
        return {
          ...next,
          current_lat: prev.current_lat,
          current_lng: prev.current_lng,
          last_updated_at: prev.last_updated_at,
          status: prev.status,
          is_stale: prev.is_stale,
          trip_active: next.trip_active || prev.trip_active,
        };
      }
      return next;
    });
    setStop(selected.stop);
    setRouteName(selected.route?.name ?? null);
  }, [children, selectedIndex]);

  useEffect(() => {
    if (!bus?.id) return;
    return subscribeBus(bus.id, (live, meta) => {
      setBus(live);
      if (meta?.type && meta.type !== "location") {
        load().catch(() => undefined);
      }
    });
  }, [bus?.id, subscribeBus, load]);

  const selected = children[selectedIndex];
  const student = selected?.student;
  const eta = selected?.eta;
  const schoolArrived = Boolean(selected?.school_arrived);
  const status = tripHeadline(bus);
  const alertMinutes = user?.alert_minutes_before ?? 5;

  const toggleBoarded = async () => {
    if (!student || boardBusy) return;
    const next = !Boolean(student.boarded);
    setBoardBusy(true);
    try {
      await api.parentSetBoarded(student.id, next);
      setChildren((prev) =>
        prev.map((c, i) =>
          i === selectedIndex
            ? { ...c, student: { ...c.student, boarded: next } }
            : c,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update boarded");
    } finally {
      setBoardBusy(false);
    }
  };

  const followCoordinate = useMemo(() => {
    if (bus?.current_lat == null || bus.current_lng == null) return null;
    if (bus.current_lat === 0 && bus.current_lng === 0) return null;
    return { latitude: bus.current_lat, longitude: bus.current_lng };
  }, [bus?.current_lat, bus?.current_lng]);

  const routeCoords = useMemo<LatLng[]>(() => {
    const stops = selected?.route?.stops;
    if (!stops?.length) return [];
    return [...stops]
      .sort((a, b) => a.sequence_number - b.sequence_number)
      .map((s) => ({ latitude: s.lat, longitude: s.lng }));
  }, [selected?.route?.stops]);

  const markers = useMemo(() => {
    const list: AppMapMarker[] = [];
    if (stop) {
      list.push({
        id: stop.stop_id,
        lat: stop.lat,
        lng: stop.lng,
        title: stop.name,
        type: "stop",
      });
    }
    if (bus?.current_lat != null && bus.current_lng != null) {
      if (!(bus.current_lat === 0 && bus.current_lng === 0)) {
        list.push({
          id: bus.id,
          lat: bus.current_lat,
          lng: bus.current_lng,
          title: bus.bus_number,
          type: "bus",
          color: bus.is_stale || bus.status === "signal_lost" ? "#C46A1B" : "#1B7F4E",
        });
      }
    }
    return list;
  }, [bus, stop]);

  const initialRegion = useMemo(
    () =>
      regionFromCoords(
        markers.map((m) => ({ latitude: m.lat, longitude: m.lng })),
      ),
    [markers],
  );

  const lastSeen =
    bus?.last_updated_at != null ? new Date(bus.last_updated_at).toLocaleTimeString() : "—";

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator color="#1C4E7A" />
          <Text style={styles.muted}>Loading your child’s bus…</Text>
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headline}>Your child’s ride</Text>

        {children.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {children.map((c, i) => (
              <Pressable
                key={c.student.id}
                onPress={() => setSelectedIndex(i)}
                style={[styles.chip, i === selectedIndex && styles.chipActive]}
              >
                <Text style={[styles.chipText, i === selectedIndex && styles.chipTextActive]}>
                  {c.student.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!student ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No child linked yet</Text>
            <Text style={styles.muted}>
              Once your child is assigned to a bus stop, you can watch the live ride here.
            </Text>
            <Text style={styles.emptyCta}>Ask your school admin to link your child to a stop</Text>
          </View>
        ) : (
          <>
            <View style={styles.statusCard}>
              <View
                style={[
                  styles.dot,
                  status.tone === "live"
                    ? styles.dotLive
                    : status.tone === "warn"
                      ? styles.dotWarn
                      : styles.dotIdle,
                ]}
              />
              <View style={styles.statusBody}>
                <Text style={styles.statusLabel}>{status.label}</Text>
                <Text style={styles.childName}>{student.name}</Text>
                {eta?.eta_minutes != null && !schoolArrived && !student.boarded ? (
                  <>
                    <Text style={styles.etaLine}>
                      ~{Math.round(eta.eta_minutes)} min to{" "}
                      {eta.target_name || stop?.name || "your stop"}
                    </Text>
                    <Text style={styles.metaLine}>{formatDistance(eta.distance_m)}</Text>
                  </>
                ) : null}
                <Text style={styles.metaLine}>
                  Bus {bus?.bus_number || "—"}
                  {routeName ? ` · ${routeName}` : ""}
                </Text>
                <Text style={styles.metaLine}>Pickup · {stop?.name || "Not set"}</Text>
                <Text style={styles.metaLine}>Updated {lastSeen}</Text>
              </View>
            </View>

            {schoolArrived ? (
              <View style={styles.schoolBanner}>
                <Text style={styles.schoolBannerEyebrow}>School</Text>
                <Text style={styles.schoolBannerTitle}>Arrived at school</Text>
                <Text style={styles.schoolBannerBody}>
                  The bus has reached the school gate.
                </Text>
              </View>
            ) : null}

            <View style={styles.boardCard}>
              <View style={styles.boardCardHeader}>
                <Text style={styles.boardEyebrow}>Boarding</Text>
                {student.boarded ? (
                  <View style={styles.boardedPill}>
                    <Text style={styles.boardedPillText}>Confirmed</Text>
                  </View>
                ) : (
                  <Text style={styles.boardEyebrowMuted}>Action needed</Text>
                )}
              </View>
              <Pressable
                style={[styles.boardAction, student.boarded && styles.boardActionOn]}
                onPress={toggleBoarded}
                disabled={boardBusy}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: Boolean(student.boarded), busy: boardBusy }}
                accessibilityLabel={
                  student.boarded ? "Boarded. Tap to undo." : "Mark as boarded"
                }
              >
                <View style={[styles.check, student.boarded && styles.checkOn]}>
                  {boardBusy ? (
                    <ActivityIndicator size="small" color={student.boarded ? "#fff" : "#1C4E7A"} />
                  ) : (
                    <Text style={[styles.checkMark, student.boarded && styles.checkMarkOn]}>
                      {student.boarded ? "✓" : ""}
                    </Text>
                  )}
                </View>
                <View style={styles.boardCopy}>
                  <Text style={[styles.boardTitle, student.boarded && styles.boardTitleOn]}>
                    {student.boarded ? `${student.name} is boarded` : "Mark as boarded"}
                  </Text>
                  <Text style={styles.boardHint}>
                    {student.boarded
                      ? "Confirmed by you · tap to undo"
                      : "Confirm when your child is on the bus"}
                  </Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: "#1B7F4E" }]} />
                <Text style={styles.legendText}>Bus</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: "#2F5D8C" }]} />
                <Text style={styles.legendText}>Pickup stop</Text>
              </View>
              {routeCoords.length >= 2 ? (
                <View style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { backgroundColor: "#1C4E7A" }]} />
                  <Text style={styles.legendText}>Route</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.mapCard}>
              <View style={styles.mapHeader}>
                <Text style={styles.mapTitle}>Live map</Text>
                <View style={styles.watchingChip}>
                  <Text style={styles.watchingChipText}>Watching {student.name}</Text>
                </View>
              </View>
              <View style={styles.mapModeRow}>
                <Pressable
                  style={[styles.mapModeBtn, cameraMode === "follow" && styles.mapModeBtnActive]}
                  onPress={() => {
                    setCameraMode("follow");
                    setMapEpoch((n) => n + 1);
                  }}
                >
                  <Text
                    style={[styles.mapModeText, cameraMode === "follow" && styles.mapModeTextActive]}
                  >
                    Follow bus
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.mapModeBtn, cameraMode === "overview" && styles.mapModeBtnActive]}
                  onPress={() => {
                    setCameraMode("overview");
                    setMapEpoch((n) => n + 1);
                  }}
                >
                  <Text
                    style={[
                      styles.mapModeText,
                      cameraMode === "overview" && styles.mapModeTextActive,
                    ]}
                  >
                    Show bus + stop
                  </Text>
                </Pressable>
              </View>
              <View style={styles.mapInner}>
                <AppMapView
                  key={`parent-map-${selectedIndex}-${mapEpoch}`}
                  markers={markers}
                  initialRegion={initialRegion}
                  followCoordinate={followCoordinate}
                  cameraMode={cameraMode}
                  routeCoords={routeCoords}
                />
              </View>
            </View>

            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>How the map works</Text>
              <Text style={styles.tipBody}>
                Green = bus, blue = your child’s stop, line = full route. Follow bus keeps the camera on
                the live pin; Show bus + stop zooms out so both stay visible. Demo route stops are near
                Bangalore — for a clean test use driver Tools → Simulate GPS. Alerts fire about{" "}
                {alertMinutes} minutes before {stop?.name || "your stop"}.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F6F8" },
  scroll: { padding: 20, paddingBottom: 28, gap: 12 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  greeting: { color: "#5A6A7A", fontSize: 15 },
  headline: { fontSize: 28, fontWeight: "700", color: "#152433", marginBottom: 4 },
  muted: { color: "#6B7A8A", fontSize: 14, lineHeight: 20 },
  error: { color: "#A32020", marginBottom: 4 },
  chipRow: { flexGrow: 0, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D7E0E8",
  },
  chipActive: { backgroundColor: "#1C4E7A", borderColor: "#1C4E7A" },
  chipText: { color: "#1C2B3A", fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  statusCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8EE",
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  dotLive: { backgroundColor: "#1B7F4E" },
  dotWarn: { backgroundColor: "#C46A1B" },
  dotIdle: { backgroundColor: "#8A96A3" },
  statusBody: { flex: 1, gap: 4 },
  statusLabel: { fontSize: 13, fontWeight: "700", color: "#1C4E7A", textTransform: "uppercase" },
  childName: { fontSize: 22, fontWeight: "700", color: "#152433" },
  etaLine: { fontSize: 18, fontWeight: "700", color: "#1B7F4E", marginTop: 2 },
  etaSource: { color: "#8A96A3", fontSize: 12 },
  metaLine: { color: "#4A5A6A", fontSize: 14 },
  schoolBanner: {
    backgroundColor: "#E7F6EC",
    borderWidth: 1,
    borderColor: "#B7E0C2",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 2,
  },
  schoolBannerEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1B7F4E",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  schoolBannerTitle: { color: "#145A36", fontWeight: "700", fontSize: 17 },
  schoolBannerBody: { color: "#2F5A3F", fontSize: 14, lineHeight: 20, marginTop: 2 },
  boardCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8EE",
    padding: 16,
    gap: 12,
  },
  boardCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  boardEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1C4E7A",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  boardEyebrowMuted: { fontSize: 12, fontWeight: "600", color: "#8A96A3" },
  boardedPill: {
    backgroundColor: "#E7F6EC",
    borderWidth: 1,
    borderColor: "#B7E0C2",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  boardedPillText: { color: "#1B7F4E", fontSize: 12, fontWeight: "700" },
  boardAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#D5DEE7",
    backgroundColor: "#F7F9FB",
  },
  boardActionOn: {
    borderColor: "#1B7F4E",
    backgroundColor: "#F3FAF5",
  },
  check: {
    width: 26,
    height: 26,
    borderWidth: 1.5,
    borderColor: "#1C4E7A",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkOn: { backgroundColor: "#1B7F4E", borderColor: "#1B7F4E" },
  checkMark: { color: "#1C4E7A", fontWeight: "700", fontSize: 15, lineHeight: 18 },
  checkMarkOn: { color: "#fff" },
  boardCopy: { flex: 1, gap: 3 },
  boardTitle: { fontWeight: "700", color: "#152433", fontSize: 16 },
  boardTitleOn: { color: "#145A36" },
  boardHint: { color: "#6B7A8A", fontSize: 13, lineHeight: 18 },
  legendRow: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 2 },
  legendText: { color: "#5A6A7A", fontSize: 13 },
  mapCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8EE",
    overflow: "hidden",
  },
  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  mapTitle: {
    fontWeight: "700",
    color: "#152433",
  },
  watchingChip: {
    backgroundColor: "#E8F1F8",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#C5D6E6",
  },
  watchingChipText: { color: "#1C4E7A", fontSize: 12, fontWeight: "600" },
  mapModeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  mapModeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C9D2DC",
    backgroundColor: "#fff",
  },
  mapModeBtnActive: { backgroundColor: "#1C4E7A", borderColor: "#1C4E7A" },
  mapModeText: { color: "#5A6A7A", fontWeight: "600", fontSize: 13 },
  mapModeTextActive: { color: "#fff" },
  mapInner: { height: 280, overflow: "hidden", zIndex: 0 },
  tipCard: {
    backgroundColor: "#E8F1F8",
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#1C4E7A",
  },
  tipTitle: { fontWeight: "700", color: "#1C4E7A", marginBottom: 4 },
  tipBody: { color: "#334455", fontSize: 14, lineHeight: 20 },
  emptyCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8EE",
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#152433" },
  emptyCta: {
    marginTop: 4,
    color: "#1C4E7A",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
});
