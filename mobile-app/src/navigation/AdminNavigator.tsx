import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { AdminAlertsScreen } from "../screens/admin/AdminAlertsScreen";
import { AdminAssignmentsScreen } from "../screens/admin/AdminAssignmentsScreen";
import { AdminAuditScreen } from "../screens/admin/AdminAuditScreen";
import { AdminDashboardScreen } from "../screens/admin/AdminDashboardScreen";
import { AdminManageHomeScreen } from "../screens/admin/AdminManageHomeScreen";
import { AdminPeopleScreen } from "../screens/admin/AdminPeopleScreen";
import { AdminProfileScreen } from "../screens/admin/AdminProfileScreen";
import { AdminRoutesScreen } from "../screens/admin/AdminRoutesScreen";

export type AdminManageParamList = {
  ManageHome: undefined;
  People: undefined;
  Routes: undefined;
  Assignments: undefined;
  Audit: undefined;
};

export type AdminTabParamList = {
  Fleet: undefined;
  Manage: undefined;
  Alerts: undefined;
  Profile: undefined;
};

/** @deprecated kept for older imports — use AdminTabParamList */
export type AdminStackParamList = AdminManageParamList & {
  Dashboard: undefined;
  Alerts: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();
const ManageStack = createNativeStackNavigator<AdminManageParamList>();

function TabIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconWrap} pointerEvents="none">
      <Text style={{ color, fontSize: 13 }}>●</Text>
    </View>
  );
}

function AdminManageNavigator() {
  return (
    <ManageStack.Navigator>
      <ManageStack.Screen name="ManageHome" component={AdminManageHomeScreen} options={{ headerShown: false }} />
      <ManageStack.Screen name="People" component={AdminPeopleScreen} options={{ title: "Drivers & parents" }} />
      <ManageStack.Screen name="Routes" component={AdminRoutesScreen} options={{ title: "Routes & stops" }} />
      <ManageStack.Screen
        name="Assignments"
        component={AdminAssignmentsScreen}
        options={{ title: "Buses & assignments" }}
      />
      <ManageStack.Screen name="Audit" component={AdminAuditScreen} options={{ headerShown: false }} />
    </ManageStack.Navigator>
  );
}

export function AdminNavigator() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 10);

  return (
    <Tab.Navigator
      screenOptions={{
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
        tabBarIcon: ({ color }) => <TabIcon color={color} />,
      }}
    >
      <Tab.Screen name="Fleet" component={AdminDashboardScreen} />
      <Tab.Screen name="Manage" component={AdminManageNavigator} />
      <Tab.Screen name="Alerts" component={AdminAlertsScreen} />
      <Tab.Screen name="Profile" component={AdminProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabLabel: { fontSize: 12, fontWeight: "600" },
  tabItem: { paddingTop: 2 },
  iconWrap: { alignItems: "center" },
});
