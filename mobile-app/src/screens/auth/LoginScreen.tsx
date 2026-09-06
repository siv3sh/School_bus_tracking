import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../config/env";

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("driver@schoolbus.app");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setBusy(true);
    setError("");
    try {
      await login(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.mark}>
        <Text style={styles.markText}>SB</Text>
      </View>
      <Text style={styles.brand}>School Bus Tracker</Text>
      <Text style={styles.sub}>Live fleet tracking for schools, drivers, and families.</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor="#8A96A3"
        value={email}
        onChangeText={setEmail}
      />
      <View style={styles.passwordRow}>
        <TextInput
          style={[styles.input, styles.passwordInput]}
          // Android often paints secure text white-on-white without an explicit color
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          autoComplete="password"
          placeholder="Password"
          placeholderTextColor="#8A96A3"
          value={password}
          onChangeText={setPassword}
          underlineColorAndroid="transparent"
        />
        <Pressable style={styles.showBtn} onPress={() => setShowPassword((v) => !v)}>
          <Text style={styles.showBtnText}>{showPassword ? "Hide" : "Show"}</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={onSubmit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
      <Text style={styles.hint}>Authorized school accounts only.</Text>
      <Text style={styles.host}>{API_URL.replace(/^https?:\/\//, "")}</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F7F4EF",
  },
  mark: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#1C4E7A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  markText: { color: "#fff", fontWeight: "700", letterSpacing: 0.4 },
  brand: { fontSize: 28, fontWeight: "700", color: "#1C2B3A", marginBottom: 6 },
  sub: { color: "#5A6A7A", marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: "#C9D2DC",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
    color: "#1C2B3A",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  passwordInput: {
    flex: 1,
    marginBottom: 0,
  },
  showBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  showBtnText: {
    color: "#1C4E7A",
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#1C4E7A",
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  error: { color: "#A32020", marginBottom: 8 },
  hint: { marginTop: 20, color: "#7A8694", fontSize: 12 },
  host: { marginTop: 6, color: "#9AA6B2", fontSize: 11 },
});
