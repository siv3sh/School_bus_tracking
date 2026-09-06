import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { api } from "../../services/api";
import type { Route, Stop, User } from "../../types";

type PersonRole = "driver" | "parent";

export function AdminPeopleScreen() {
  const [people, setPeople] = useState<User[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [role, setRole] = useState<PersonRole>("driver");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [childName, setChildName] = useState("");
  const [routeId, setRouteId] = useState<string | null>(null);
  const [stopId, setStopId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === routeId) ?? null,
    [routes, routeId],
  );
  const stops: Stop[] = selectedRoute?.stops ?? [];

  const refresh = async () => {
    const [users, routeList] = await Promise.all([api.listSchoolUsers(), api.adminRoutes()]);
    setPeople(users.filter((u) => u.role === "driver" || u.role === "parent"));
    setRoutes(routeList);
  };

  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, []);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setChildName("");
    setRouteId(null);
    setStopId(null);
  };

  const create = async () => {
    if (!name.trim() || !email.trim() || password.trim().length < 8) {
      setMessage("Name, email, and a password of at least 8 characters are required.");
      return;
    }
    if (role === "parent" && childName.trim() && (!routeId || !stopId)) {
      setMessage("Pick a route and stop for the child, or clear the child name.");
      return;
    }
    try {
      const created = await api.createSchoolUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        phone: phone.trim() || undefined,
        password: password.trim(),
      });
      if (role === "parent" && childName.trim() && routeId && stopId) {
        await api.createStudent({
          name: childName.trim(),
          parent_id: created.user.id,
          route_id: routeId,
          stop_id: stopId,
        });
      }
      resetForm();
      await refresh();
      setMessage(
        role === "parent"
          ? `Parent ${created.user.email} can log in. Share that email and password with them.`
          : `Driver ${created.user.email} can log in. Share that email and password with them.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Create failed");
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.intro}>
        Create drivers and parents for this school. They log into the mobile app with the email and
        password you set.
      </Text>
      {message ? <Text style={styles.msg}>{message}</Text> : null}

      <Text style={styles.label}>Account type</Text>
      <View style={styles.chipRow}>
        {(["driver", "parent"] as const).map((item) => {
          const active = role === item;
          return (
            <Pressable
              key={item}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setRole(item)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item === "driver" ? "Driver" : "Parent"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Full name"
        placeholderTextColor="#8A96A3"
        autoCapitalize="words"
      />
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#8A96A3"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="Phone (optional)"
        placeholderTextColor="#8A96A3"
        keyboardType="phone-pad"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password (min 8 characters)"
        placeholderTextColor="#8A96A3"
        secureTextEntry
      />

      {role === "parent" ? (
        <View style={styles.childBox}>
          <Text style={styles.label}>Child on a bus (optional)</Text>
          <TextInput
            style={styles.input}
            value={childName}
            onChangeText={setChildName}
            placeholder="Child name"
            placeholderTextColor="#8A96A3"
          />
          <Text style={styles.hint}>Route</Text>
          {routes.length === 0 ? (
            <Text style={styles.sub}>Create a route with stops first under Routes & stops.</Text>
          ) : (
            routes.map((r) => (
              <Pressable
                key={r.id}
                style={[styles.chip, routeId === r.id && styles.chipActive]}
                onPress={() => {
                  setRouteId(r.id);
                  setStopId(null);
                }}
              >
                <Text style={[styles.chipText, routeId === r.id && styles.chipTextActive]}>{r.name}</Text>
              </Pressable>
            ))
          )}
          {selectedRoute ? (
            <>
              <Text style={styles.hint}>Pickup stop</Text>
              {stops
                .slice()
                .sort((a, b) => a.sequence_number - b.sequence_number)
                .map((s) => (
                  <Pressable
                    key={s.stop_id}
                    style={[styles.chip, stopId === s.stop_id && styles.chipActive]}
                    onPress={() => setStopId(s.stop_id)}
                  >
                    <Text style={[styles.chipText, stopId === s.stop_id && styles.chipTextActive]}>
                      {s.sequence_number}. {s.name}
                    </Text>
                  </Pressable>
                ))}
            </>
          ) : null}
        </View>
      ) : null}

      <Pressable style={styles.btn} onPress={create}>
        <Text style={styles.btnText}>{role === "driver" ? "Create driver" : "Create parent"}</Text>
      </Pressable>

      <Text style={styles.listTitle}>People ({people.length})</Text>
      {people.length === 0 ? (
        <Text style={styles.sub}>No drivers or parents yet.</Text>
      ) : (
        people.map((p) => (
          <View key={p.id} style={styles.card}>
            <Text style={styles.cardTitle}>{p.name}</Text>
            <Text style={styles.meta}>
              {p.role === "driver" ? "Driver" : "Parent"} · {p.email}
              {p.status === "invited" ? " · Invited" : ""}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F6F8" },
  scroll: { padding: 16, paddingBottom: 40, gap: 8 },
  intro: { color: "#5A6A7A", lineHeight: 20, marginBottom: 4 },
  msg: { color: "#1B7F4E", fontWeight: "600" },
  label: { color: "#5A6A7A", fontWeight: "700", marginTop: 8, textTransform: "uppercase", fontSize: 12 },
  hint: { color: "#8A96A3", fontSize: 12, fontWeight: "700", marginTop: 8 },
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
    padding: 12,
    color: "#1C2B3A",
    fontSize: 16,
  },
  childBox: { gap: 8, marginTop: 4 },
  btn: { backgroundColor: "#1C4E7A", padding: 14, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "700" },
  sub: { color: "#5A6A7A" },
  listTitle: { fontWeight: "700", color: "#152433", marginTop: 16, marginBottom: 4 },
  card: { backgroundColor: "#fff", padding: 12, marginTop: 8, borderWidth: 1, borderColor: "#E2E8EE" },
  cardTitle: { fontWeight: "700", color: "#152433" },
  meta: { color: "#5A6A7A", marginTop: 4 },
});
