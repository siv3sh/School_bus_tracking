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
import type { AuditLog } from "../../types";

function shortMeta(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return "—";
  try {
    const raw = JSON.stringify(meta);
    return raw.length > 80 ? `${raw.slice(0, 77)}…` : raw;
  } catch {
    return "—";
  }
}

export function AdminAuditScreen() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLogs(await api.adminAudit());
    } catch {
      // keep prior list
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
        <Text style={styles.title}>Trip audit log</Text>
        <Text style={styles.sub}>Start/end trip, stop reaches, boarding, and broadcasts</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color="#1C4E7A" />
      ) : (
        <FlatList
          data={logs}
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
              <Text style={styles.emptyTitle}>No audit entries yet</Text>
              <Text style={styles.emptyBody}>
                Driver trip actions and admin changes will show up here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.accent} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.action}</Text>
                <Text style={styles.meta}>
                  {item.actor_role}
                  {item.bus_id ? ` · Bus …${item.bus_id.slice(-6)}` : ""}
                </Text>
                <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text>
                <Text style={styles.metaJson} numberOfLines={2}>
                  {shortMeta(item.meta)}
                </Text>
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
  },
  accent: { width: 4, backgroundColor: "#1C4E7A" },
  rowBody: { flex: 1, padding: 14, gap: 4 },
  rowTitle: { fontWeight: "700", color: "#152433", fontSize: 15 },
  meta: { color: "#5A6A7A", fontSize: 13 },
  metaJson: { color: "#8A96A3", fontSize: 12 },
  empty: { paddingTop: 40, paddingHorizontal: 12, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#152433", textAlign: "center" },
  emptyBody: { color: "#6B7A8A", textAlign: "center", lineHeight: 20 },
});
