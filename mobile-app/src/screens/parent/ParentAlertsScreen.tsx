import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../../services/api";
import type { AlertLog } from "../../types";

function alertTitle(type: string, message?: string | null): string {
  if (type === "school_arrived") return "Arrived at school";
  if (type === "5_min_warning") return "Bus is about 5 minutes away";
  if (type === "eta_warning") return "Bus is almost at your stop";
  if (type === "delay") return message || "Bus delay";
  if (type === "emergency") return message || "Emergency alert";
  if (message) return message;
  return type.replace(/_/g, " ");
}

export function ParentAlertsScreen() {
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setAlerts(await api.parentAlerts());
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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Alerts</Text>
        <Text style={styles.sub}>Stop warnings, boarding, and school arrival</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color="#1C4E7A" />
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No alerts yet</Text>
              <Text style={styles.emptyBody}>
                When the bus is roughly 5 minutes from your stop, a notice will show up here — and as a
                push notification if you’ve enabled them.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowAccent} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{alertTitle(item.type, item.message)}</Text>
                <Text style={styles.rowMeta}>{new Date(item.sent_at).toLocaleString()}</Text>
              </View>
            </View>
          )}
        />
      )}
      <Pressable style={styles.refreshBtn} onPress={() => { setRefreshing(true); load(); }}>
        <Text style={styles.refreshText}>Refresh</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F6F8" },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: "700", color: "#152433" },
  sub: { color: "#5A6A7A", marginTop: 4 },
  list: { paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 },
  row: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8EE",
    overflow: "hidden",
  },
  rowAccent: { width: 4, backgroundColor: "#1C4E7A" },
  rowBody: { flex: 1, padding: 14, gap: 4 },
  rowTitle: { fontWeight: "700", color: "#152433", fontSize: 15 },
  rowMeta: { color: "#5A6A7A", fontSize: 13 },
  empty: { paddingVertical: 40, paddingHorizontal: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#152433", marginBottom: 8 },
  emptyBody: { color: "#6B7A8A", lineHeight: 20 },
  refreshBtn: { alignItems: "center", paddingVertical: 12 },
  refreshText: { color: "#1C4E7A", fontWeight: "600" },
});
