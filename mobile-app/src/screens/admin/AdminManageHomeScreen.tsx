import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { AdminManageParamList } from "../../navigation/AdminNavigator";

export function AdminManageHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AdminManageParamList>>();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.wrap}>
        <Text style={styles.title}>Manage</Text>
        <Text style={styles.sub}>People, buses, routes, and who drives which bus.</Text>

        <Pressable style={styles.card} onPress={() => navigation.navigate("People")}>
          <Text style={styles.cardTitle}>Drivers & parents</Text>
          <Text style={styles.cardBody}>Create driver and parent logins. Optionally assign a child to a stop.</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => navigation.navigate("Routes")}>
          <Text style={styles.cardTitle}>Routes & stops</Text>
          <Text style={styles.cardBody}>Create or edit routes with manual lat/lng stop points.</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => navigation.navigate("Assignments")}>
          <Text style={styles.cardTitle}>Buses & assignments</Text>
          <Text style={styles.cardBody}>Add buses, then link a driver and route to each one.</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => navigation.navigate("Audit")}>
          <Text style={styles.cardTitle}>Trip audit log</Text>
          <Text style={styles.cardBody}>Review trip starts, stop reaches, boarding, and broadcasts.</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F6F8" },
  wrap: { padding: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: "700", color: "#152433" },
  sub: { color: "#5A6A7A", marginBottom: 8 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8EE",
    padding: 16,
    gap: 6,
  },
  cardTitle: { fontWeight: "700", color: "#1C4E7A", fontSize: 16 },
  cardBody: { color: "#4A5A6A", lineHeight: 20 },
});
