import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { AdminNavigator } from "./AdminNavigator";
import { DriverNavigator } from "./DriverNavigator";
import { ParentNavigator } from "./ParentNavigator";

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <Stack.Navigator>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      ) : user.role === "driver" ? (
        <DriverNavigator />
      ) : user.role === "parent" ? (
        <ParentNavigator />
      ) : (
        <AdminNavigator />
      )}
    </NavigationContainer>
  );
}
