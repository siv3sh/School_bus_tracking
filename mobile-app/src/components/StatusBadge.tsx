import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  isStale: boolean;
  lastUpdatedAt?: string | null;
  status?: string;
};

export function StatusBadge({ isStale, lastUpdatedAt, status }: Props) {
  const live = !isStale && status !== "signal_lost";
  const time = lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "—";
  return (
    <View style={[styles.badge, live ? styles.live : styles.offline]}>
      <Text style={styles.text}>
        {live ? "Live" : `Offline — last seen at ${time}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  live: { backgroundColor: "#1B7F4E" },
  offline: { backgroundColor: "#C46A1B" },
  text: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
