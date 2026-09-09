import { COLORS } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet, useColorScheme, View } from "react-native";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDark ? "#69A7F5" : COLORS.primary,
        tabBarInactiveTintColor: isDark ? "#AEB3BC" : "#6B7280",
        tabBarStyle: styles.tabBar,

        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
        tabBarBackground: () => (
          <BlurView
            intensity={95}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          >
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: isDark
                    ? "rgba(10, 12, 16, 0.42)"
                    : "rgba(255, 255, 255, 0.28)",
                },
              ]}
            />
          </BlurView>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ana Sayfa",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="daily"
        options={{
          title: "Günlük",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="contractors"
        options={{
          title: "Taşeron",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(documents)"
        options={{
          title: "Belgeler",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="documents" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 25,
    height: 60,
    paddingBottom: 10,

    elevation: 10,
    backgroundColor: "transparent",
    borderTopWidth: 0,
    overflow: "hidden",
  },
});
