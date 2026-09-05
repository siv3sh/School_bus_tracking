import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import { useAuth } from "../../context/AuthContext";
import { useNetwork } from "../../context/NetworkContext";
import { useSockets } from "../../context/SocketContext";
import type { DriverTabParamList } from "../../navigation/DriverNavigator";
import { api } from "../../services/api";
import {
  flushPendingIfOnline,
  loadPendingPoint,
  requestLocationPermissions,
  setLocationPublishDeps,
  startTracking,
  stopTracking,
} from "../../services/locationService";
import type { BusSocket } from "../../services/socketService";
import type { Bus, Route, Stop } from "../../types";

export function DriverHomeScreen() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { openDriverSocket } = useSockets();
  const navigation = useNavigation<BottomTabNavigationProp<DriverTabParamList>>();

  const [bus, setBus] = useState<Bus | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [nextStop, setNextStop] = useState<Stop | null>(null);
  const [tracking, setTracking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingTime, setPendingTime] = useState<string | null>(null);
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const socketRef = useRef<BusSocket | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.myBus();
      setBus(data.bus);
      setRoute(data.route);
      setNextStop(data.next_stop ?? null);
      setTracking(Boolean(data.bus.trip_active));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load bus");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setLocationPublishDeps({ isOnline, socket: socketRef.current });
    if (isOnline && tracking) {
      flushPendingIfOnline(true, socketRef.current).catch(() => undefined);
    }
  }, [isOnline, tracking]);

  useEffect(() => {
    const id = setInterval(async () => {
      const p = await loadPendingPoint();
      setPendingTime(p?.recorded_at ?? null);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const onStart = async () => {
    if (!bus) return;
    setMessage("");
    setBusy(true);
    const perm = await requestLocationPermissions();
    if (!perm.ok) {
      setMessage(perm.message || "Location permission denied");
      setBusy(false);
      return;
    }
    try {
      await api.startTrip(bus.id);
      socketRef.current?.close();
      socketRef.current = openDriverSocket(bus.id);
      setLocationPublishDeps({ isOnline, socket: socketRef.current });
      await startTracking(bus.id);
      setTracking(true);
      Vibration.vibrate(400);
      await refresh();
      setMessage("Trip started — parents can see your live location now.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not start trip");
    } finally {
      setBusy(false);
    }
  };

  const onEnd = async () => {
    if (!bus) return;
    setBusy(true);
    try {
      await stopTracking();
      socketRef.current?.close();
      socketRef.current = null;
      await api.endTrip(bus.id);
      setTracking(false);
      await refresh();
      setMessage("Trip ended. Location sharing stopped.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not end trip");
    } finally {
      setBusy(false);
    }
  };

  const onMarkStop = async () => {
    if (!bus) return;
    setBusy(true);
    setMessage("");
    try {
      await api.markStopReached(bus.id);
      await refresh();
      setMessage("Stop marked as reached.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not mark stop");
    } finally {
      setBusy(false);
    }
  };

  const onBroadcast = async (type: "delay" | "emergency", text: string) => {
    if (!bus) return;
    setBroadcastBusy(true);
    setMessage(text);
    try {
      const res = await api.broadcast(bus.id, { type, message: text });
      setMessage(`${text} — notified ${res.notified} parent(s).`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not send broadcast");
    } finally {
      setBroadcastBusy(false);
    }
  };

  const connectionTone = !tracking ? "idle" : isOnline ? "live" : "warn";
  const connectionLabel = !tracking
    ? "Ready when you are"
    : isOnline
      ? "Sharing live with parents"
      : `Offline — last GPS ${pendingTime ? new Date(pendingTime).toLocaleTimeString() : "—"} (syncs on reconnect)`;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator color="#1C4E7A" />
          <Text style={styles.muted}>Loading your bus…</Text>
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
              refresh();
            }}
            tintColor="#1C4E7A"
          />
        }
      >
        <Text style={styles.greeting}>Hi{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</Text>
        <Text style={styles.headline}>Today’s trip</Text>

        {message ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{message}</Text>
          </View>
        ) : null}

        {!bus ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No bus assigned</Text>
            <Text style={styles.muted}>Ask an admin to assign you to a bus and route.</Text>
          </View>
        ) : (
          <>
            <View style={styles.statusCard}>
              <View
                style={[
                  styles.dot,
                  connectionTone === "live"
                    ? styles.dotLive
                    : connectionTone === "warn"
                      ? styles.dotWarn
                      : styles.dotIdle,
                ]}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.statusEyebrow}>{connectionLabel}</Text>
                <Text style={styles.busNumber}>{bus.bus_number}</Text>
                <Text style={styles.meta}>Route: {route?.name || "Unassigned"}</Text>
                <Text style={styles.meta}>
                  Network: {isOnline ? "Online" : "Offline"}
                  {tracking ? " · Tracking on" : ""}
                </Text>
              </View>
            </View>

            {nextStop ? (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Next stop</Text>
                <Text style={styles.cardTitle}>{nextStop.name}</Text>
                <Pressable
                  style={[styles.markBtn, busy && styles.btnDisabled]}
                  onPress={onMarkStop}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.markBtnText}>Mark stop reached</Text>
                  )}
                </Pressable>
              </View>
            ) : tracking ? (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Next stop</Text>
                <Text style={styles.muted}>All stops reached, or none configured.</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Notify parents</Text>
              <Pressable
                style={[styles.delayBtn, broadcastBusy && styles.btnDisabled]}
                onPress={() => onBroadcast("delay", "Running 10 minutes late")}
                disabled={broadcastBusy || !tracking}
              >
                <Text style={styles.delayBtnText}>Delay</Text>
                <Text style={styles.presetHint}>Running 10 minutes late</Text>
              </Pressable>
              <Pressable
                style={[styles.emergencyBtn, broadcastBusy && styles.btnDisabled]}
                onPress={() => onBroadcast("emergency", "Emergency — please contact school")}
                disabled={broadcastBusy || !tracking}
              >
                <Text style={styles.emergencyBtnText}>Emergency</Text>
                <Text style={styles.presetHintLight}>Emergency — please contact school</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Stops on this route</Text>
              {(route?.stops || []).length === 0 ? (
                <Text style={styles.muted}>No stops configured yet.</Text>
              ) : (
                (route?.stops || [])
                  .slice()
                  .sort((a, b) => a.sequence_number - b.sequence_number)
                  .map((s, i) => (
                    <View key={s.stop_id} style={styles.stopRow}>
                      <Text style={styles.stopIndex}>{i + 1}</Text>
                      <Text style={styles.stopName}>{s.name}</Text>
                      {s.reached ? <Text style={styles.reachedTag}>Reached</Text> : null}
                    </View>
                  ))
              )}
            </View>

            <Pressable
              style={[styles.primaryBtn, tracking ? styles.btnDanger : styles.btnGo]}
              onPress={tracking ? onEnd : onStart}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>{tracking ? "End trip" : "Start trip"}</Text>
              )}
            </Pressable>

            <Text style={styles.help}>
              Starting a trip turns on GPS (including background) so parents can follow the bus live.
            </Text>

            <Pressable
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate("Tools", { screen: "SimulateLocation" })}
            >
              <Text style={styles.secondaryBtnText}>Test without driving (simulate GPS)</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F6F8" },
  scroll: { padding: 20, paddingBottom: 32, gap: 12 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  greeting: { color: "#5A6A7A", fontSize: 15 },
  headline: { fontSize: 28, fontWeight: "700", color: "#152433" },
  muted: { color: "#6B7A8A", fontSize: 14, lineHeight: 20 },
  banner: {
    backgroundColor: "#E8F1F8",
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#1C4E7A",
  },
  bannerText: { color: "#334455", fontSize: 14 },
  statusCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8EE",
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  dotLive: { backgroundColor: "#1B7F4E" },
  dotWarn: { backgroundColor: "#C46A1B" },
  dotIdle: { backgroundColor: "#8A96A3" },
  statusEyebrow: { fontSize: 12, fontWeight: "700", color: "#1C4E7A", textTransform: "uppercase" },
  busNumber: { fontSize: 26, fontWeight: "700", color: "#152433" },
  meta: { color: "#4A5A6A", fontSize: 14 },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8EE",
    gap: 8,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#152433" },
  cardLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1C4E7A",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  markBtn: {
    marginTop: 4,
    backgroundColor: "#1C4E7A",
    paddingVertical: 12,
    alignItems: "center",
  },
  markBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  delayBtn: {
    backgroundColor: "#FFF6E8",
    borderWidth: 1,
    borderColor: "#E8C48A",
    padding: 12,
    gap: 4,
  },
  delayBtnText: { fontWeight: "700", color: "#C46A1B", fontSize: 15 },
  emergencyBtn: {
    backgroundColor: "#A32020",
    padding: 12,
    gap: 4,
  },
  emergencyBtnText: { fontWeight: "700", color: "#fff", fontSize: 15 },
  presetHint: { color: "#8A6A3A", fontSize: 13 },
  presetHintLight: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  stopRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  stopIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E8F1F8",
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "700",
    color: "#1C4E7A",
    overflow: "hidden",
  },
  stopName: { flex: 1, color: "#152433", fontSize: 15, fontWeight: "500" },
  reachedTag: { color: "#1B7F4E", fontSize: 12, fontWeight: "700" },
  primaryBtn: { paddingVertical: 16, alignItems: "center" },
  btnGo: { backgroundColor: "#1B7F4E" },
  btnDanger: { backgroundColor: "#A32020" },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  help: { color: "#6B7A8A", fontSize: 13, lineHeight: 18 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#1C4E7A",
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  secondaryBtnText: { color: "#1C4E7A", fontWeight: "700" },
});
