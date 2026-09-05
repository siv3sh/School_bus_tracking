import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../../services/api";
import type { AlertLog } from "../../types";

function alertTitle(type: string): string {
  if (type === "5_min_warning") return "5-minute arrival warning";
  return type.replace(/_/g, " ");
}

export function AdminAlertsScreen() {
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setAlerts(await api.adminAlerts());
    } catch {
      // keep
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
        <Text style={styles.title}>Alert log</Text>
        <Text style={styles.sub}>All parent arrival notifications across buses</Text>
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
                When drivers approach stops and the 5-minute rule fires, entries appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.accent} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{alertTitle(item.type)}</Text>
                <Text style={styles.meta}>
                  Bus …{item.bus_id.slice(-6)} · Parent …{item.parent_id.slice(-6)}
                </Text>
                <Text style={styles.meta}>{new Date(item.sent_at).toLocaleString()}</Text>
              </View>
            </View>
          )}
        />
      )}
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
  accent: { width: 4, backgroundColor: "#1C4E7A" },
  rowBody: { flex: 1, padding: 14, gap: 4 },
  rowTitle: { fontWeight: "700", color: "#152433" },
  meta: { color: "#5A6A7A", fontSize: 13 },
  empty: { paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#152433", marginBottom: 8 },
  emptyBody: { color: "#6B7A8A", lineHeight: 20 },
});
