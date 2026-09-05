import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../context/AuthContext";

export function AdminProfileScreen() {
  const { user, logout } = useAuth();
  const initials = (user?.name || "A")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View>
            <Text style={styles.name}>{user?.name || "Admin"}</Text>
            <Text style={styles.role}>School admin</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Account</Text>
          <Text style={styles.rowLabel}>Email</Text>
          <Text style={styles.rowValue}>{user?.email || "—"}</Text>
          <Text style={[styles.rowLabel, { marginTop: 10 }]}>Phone</Text>
          <Text style={styles.rowValue}>{user?.phone || "Not set"}</Text>
        </View>

        <View style={styles.tip}>
          <Text style={styles.tipTitle}>Your role</Text>
          <Text style={styles.tipBody}>
            Watch the fleet live, manage routes/stops, assign drivers, and review arrival alerts sent to
            parents.
          </Text>
        </View>

        <Pressable style={styles.logoutBtn} onPress={() => logout()}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F6F8" },
  scroll: { padding: 20, gap: 14 },
  title: { fontSize: 28, fontWeight: "700", color: "#152433" },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fff",
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8EE",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1C4E7A",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  name: { fontSize: 20, fontWeight: "700", color: "#152433" },
  role: { color: "#5A6A7A", marginTop: 2 },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8EE",
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1C4E7A",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  rowLabel: { color: "#7A8694", fontSize: 12 },
  rowValue: { color: "#152433", fontSize: 15, fontWeight: "500" },
  tip: {
    backgroundColor: "#E8F1F8",
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#1C4E7A",
  },
  tipTitle: { fontWeight: "700", color: "#1C4E7A", marginBottom: 4 },
  tipBody: { color: "#334455", fontSize: 14, lineHeight: 20 },
  logoutBtn: { backgroundColor: "#A32020", paddingVertical: 14, alignItems: "center", marginTop: 8 },
  logoutText: { color: "#fff", fontWeight: "700" },
});
