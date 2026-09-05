import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { registerForPushNotifications } from "../../services/notifications";
import type { ChildBundle, SchoolContact } from "../../types";

const ALERT_OPTIONS = [5, 10, 15] as const;

export function ParentProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [children, setChildren] = useState<ChildBundle[]>([]);
  const [school, setSchool] = useState<SchoolContact | null>(null);
  const [loadingKids, setLoadingKids] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [prefsMessage, setPrefsMessage] = useState("");

  const loadKids = useCallback(async () => {
    try {
      setChildren(await api.parentChildren());
    } catch {
      setChildren([]);
    } finally {
      setLoadingKids(false);
    }
  }, []);

  const loadSchool = useCallback(async () => {
    try {
      setSchool(await api.schoolContact());
    } catch {
      setSchool(null);
    }
  }, []);

  useEffect(() => {
    loadKids();
    loadSchool();
  }, [loadKids, loadSchool]);

  const enablePush = async () => {
    setPushBusy(true);
    setPushMessage("");
    try {
      const token = await registerForPushNotifications();
      await refreshUser();
      setPushMessage(token ? "Push notifications enabled for this device." : "Permission was not granted.");
    } catch (e) {
      setPushMessage(e instanceof Error ? e.message : "Could not enable notifications");
    } finally {
      setPushBusy(false);
    }
  };

  const setAlertMinutes = async (minutes: number) => {
    if (prefsBusy || user?.alert_minutes_before === minutes) return;
    setPrefsBusy(true);
    setPrefsMessage("");
    try {
      await api.updatePrefs(minutes);
      await refreshUser();
      setPrefsMessage(`Alerts set to ${minutes} minutes before arrival.`);
    } catch (e) {
      setPrefsMessage(e instanceof Error ? e.message : "Could not update preference");
    } finally {
      setPrefsBusy(false);
    }
  };

  const currentAlert = user?.alert_minutes_before ?? 5;

  const initials = (user?.name || "P")
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
          <View style={styles.heroText}>
            <Text style={styles.name}>{user?.name || "Parent"}</Text>
            <Text style={styles.role}>Parent account</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Account</Text>
          <Row label="Email" value={user?.email || "—"} />
          <Row label="Phone" value={user?.phone || "Not set"} />
          <Row
            label="Push alerts"
            value={user?.expo_push_token ? "Enabled on this device" : "Not enabled"}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Arrival alert timing</Text>
          <Text style={styles.muted}>
            Notify me when the bus is about this many minutes from my child’s stop.
          </Text>
          <View style={styles.prefRow}>
            {ALERT_OPTIONS.map((minutes) => {
              const active = currentAlert === minutes;
              return (
                <Pressable
                  key={minutes}
                  onPress={() => setAlertMinutes(minutes)}
                  disabled={prefsBusy}
                  style={[styles.prefChip, active && styles.prefChipActive]}
                >
                  <Text style={[styles.prefChipText, active && styles.prefChipTextActive]}>
                    {minutes} min
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {prefsBusy ? <ActivityIndicator color="#1C4E7A" /> : null}
          {prefsMessage ? <Text style={styles.pushMsg}>{prefsMessage}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Children</Text>
          {loadingKids ? (
            <ActivityIndicator color="#1C4E7A" />
          ) : children.length === 0 ? (
            <Text style={styles.muted}>No children linked to this account yet.</Text>
          ) : (
            children.map((c) => (
              <View key={c.student.id} style={styles.childRow}>
                <Text style={styles.childName}>{c.student.name}</Text>
                <Text style={styles.muted}>
                  Stop: {c.stop?.name || "—"}
                  {c.bus?.bus_number ? ` · Bus ${c.bus.bus_number}` : ""}
                </Text>
              </View>
            ))
          )}
        </View>

        {school ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>School contact</Text>
            <Text style={styles.schoolName}>{school.name}</Text>
            {school.phone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${school.phone}`)}>
                <Row label="Phone" value={school.phone} link />
              </Pressable>
            ) : (
              <Row label="Phone" value="—" />
            )}
            {school.email ? (
              <Pressable onPress={() => Linking.openURL(`mailto:${school.email}`)}>
                <Row label="Email" value={school.email} link />
              </Pressable>
            ) : (
              <Row label="Email" value="—" />
            )}
            <Row label="Address" value={school.address || "—"} />
          </View>
        ) : null}

        <Pressable style={styles.secondaryBtn} onPress={enablePush} disabled={pushBusy}>
          {pushBusy ? (
            <ActivityIndicator color="#1C4E7A" />
          ) : (
            <Text style={styles.secondaryBtnText}>Enable arrival notifications</Text>
          )}
        </Pressable>
        {pushMessage ? <Text style={styles.pushMsg}>{pushMessage}</Text> : null}

        <Pressable style={styles.logoutBtn} onPress={() => logout()}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  link,
}: {
  label: string;
  value: string;
  link?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, link && styles.linkValue]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F6F8" },
  scroll: { padding: 20, paddingBottom: 36, gap: 14 },
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
  heroText: { flex: 1 },
  name: { fontSize: 20, fontWeight: "700", color: "#152433" },
  role: { color: "#5A6A7A", marginTop: 2 },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8EE",
    gap: 10,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1C4E7A",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  row: { gap: 2 },
  rowLabel: { color: "#7A8694", fontSize: 12 },
  rowValue: { color: "#152433", fontSize: 15, fontWeight: "500" },
  linkValue: { color: "#1C4E7A", textDecorationLine: "underline" },
  childRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F6",
    gap: 2,
  },
  childName: { fontWeight: "700", color: "#152433", fontSize: 16 },
  schoolName: { fontWeight: "700", color: "#152433", fontSize: 16 },
  muted: { color: "#6B7A8A", fontSize: 14, lineHeight: 20 },
  prefRow: { flexDirection: "row", gap: 8 },
  prefChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#F3F6F8",
    borderWidth: 1,
    borderColor: "#D7E0E8",
  },
  prefChipActive: { backgroundColor: "#1C4E7A", borderColor: "#1C4E7A" },
  prefChipText: { color: "#1C2B3A", fontWeight: "700" },
  prefChipTextActive: { color: "#fff" },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#1C4E7A",
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  secondaryBtnText: { color: "#1C4E7A", fontWeight: "700" },
  pushMsg: { color: "#1B7F4E", fontSize: 13 },
  logoutBtn: {
    backgroundColor: "#A32020",
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  logoutText: { color: "#fff", fontWeight: "700" },
});
