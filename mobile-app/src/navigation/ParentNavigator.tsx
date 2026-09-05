import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ParentAlertsScreen } from "../screens/parent/ParentAlertsScreen";
import { ParentHomeScreen } from "../screens/parent/ParentHomeScreen";
import { ParentProfileScreen } from "../screens/parent/ParentProfileScreen";

export type ParentTabParamList = {
  Track: undefined;
  Alerts: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<ParentTabParamList>();

function TabIcon({ label, color }: { label: string; color: string }) {
  const mark = label === "Track" ? "●" : label === "Alerts" ? "◆" : "○";
  return (
    <View style={styles.iconWrap} pointerEvents="none">
      <Text style={{ color, fontSize: 13 }}>{mark}</Text>
    </View>
  );
}

export function ParentNavigator() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 10);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        lazy: false,
        tabBarActiveTintColor: "#1C4E7A",
        tabBarInactiveTintColor: "#8A96A3",
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#E2E8EE",
          borderTopWidth: 1,
          height: 52 + bottom,
          paddingBottom: bottom,
          paddingTop: 6,
          elevation: 12,
          zIndex: 100,
        },
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarIcon: ({ color }) => <TabIcon label={route.name} color={color} />,
      })}
    >
      <Tab.Screen name="Track" component={ParentHomeScreen} options={{ title: "Track" }} />
      <Tab.Screen name="Alerts" component={ParentAlertsScreen} options={{ title: "Alerts" }} />
      <Tab.Screen name="Profile" component={ParentProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabLabel: { fontSize: 12, fontWeight: "600" },
  tabItem: { paddingTop: 2 },
  iconWrap: { alignItems: "center", justifyContent: "center" },
});
