import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Define background location task at app entry (required by TaskManager).
import "./src/services/locationService";

import { AuthProvider } from "./src/context/AuthContext";
import { NetworkProvider } from "./src/context/NetworkContext";
import { SocketProvider } from "./src/context/SocketContext";
import { RootNavigator } from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NetworkProvider>
          <SocketProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </SocketProvider>
        </NetworkProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
