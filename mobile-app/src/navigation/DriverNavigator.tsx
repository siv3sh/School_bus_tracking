import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { DriverHomeScreen } from "../screens/driver/DriverHomeScreen";
import { DriverProfileScreen } from "../screens/driver/DriverProfileScreen";
import { SimulateLocationScreen } from "../screens/driver/SimulateLocationScreen";

export type DriverToolsParamList = {
  ToolsHome: undefined;
  SimulateLocation: undefined;
};

export type DriverTabParamList = {
  Trip: undefined;
  Tools: NavigatorScreenParams<DriverToolsParamList>;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<DriverTabParamList>();
const ToolsStack = createNativeStackNavigator<DriverToolsParamList>();

function TabIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconWrap} pointerEvents="none">
      <Text style={{ color, fontSize: 13 }}>●</Text>
    </View>
  );
}

function ToolsHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DriverToolsParamList>>();
  return (
    <SafeAreaView style={styles.toolsWrap} edges={["top"]}>
      <Text style={styles.toolsTitle}>Driver tools</Text>
      <Text style={styles.toolsSub}>Helpers for testing without leaving the depot.</Text>
      <Pressable style={styles.toolsCard} onPress={() => navigation.navigate("SimulateLocation")}>
        <Text style={styles.toolsCardTitle}>Simulate GPS</Text>
        <Text style={styles.toolsCardBody}>
          See route stops on the map, drag the green DRAG pin (or tap the map / a stop), then send.
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

function DriverToolsNavigator() {
  return (
    <ToolsStack.Navigator>
      <ToolsStack.Screen name="ToolsHome" component={ToolsHomeScreen} options={{ headerShown: false }} />
      <ToolsStack.Screen
        name="SimulateLocation"
        component={SimulateLocationScreen}
        options={{ title: "Simulate GPS" }}
      />
    </ToolsStack.Navigator>
  );
}

export function DriverNavigator() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 10);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        lazy: false,
        tabBarActiveTintColor: "#1B7F4E",
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
        tabBarIcon: ({ color }) => <TabIcon color={color} />,
      }}
    >
      <Tab.Screen name="Trip" component={DriverHomeScreen} />
      <Tab.Screen name="Tools" component={DriverToolsNavigator} />
      <Tab.Screen name="Profile" component={DriverProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabLabel: { fontSize: 12, fontWeight: "600" },
  tabItem: { paddingTop: 2 },
  iconWrap: { alignItems: "center" },
  toolsWrap: { flex: 1, backgroundColor: "#F3F6F8", padding: 20, gap: 10 },
  toolsTitle: { fontSize: 28, fontWeight: "700", color: "#152433" },
  toolsSub: { color: "#5A6A7A", marginBottom: 8 },
  toolsCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8EE",
    padding: 16,
    gap: 6,
  },
  toolsCardTitle: { fontWeight: "700", color: "#1C4E7A", fontSize: 16 },
  toolsCardBody: { color: "#4A5A6A", lineHeight: 20 },
});
