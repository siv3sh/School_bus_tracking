import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function AlertBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#F3E8D8",
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#8B4513",
  },
  text: { color: "#3A2A1A", fontSize: 14 },
});
