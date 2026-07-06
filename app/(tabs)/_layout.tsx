import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/ui/ThemeContext";

type IoniconName = keyof typeof Ionicons.glyphMap;

function tabIcon(active: IoniconName, inactive: IoniconName) {
  return function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? active : inactive} size={size ?? 24} color={String(color)} />;
  };
}

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 58 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.2,
          marginTop: Platform.OS === "ios" ? 2 : 0
        },
        tabBarIconStyle: { marginTop: 2 }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "今日",
          tabBarIcon: tabIcon("today", "today-outline")
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: "习惯",
          tabBarIcon: tabIcon("repeat", "repeat-outline")
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: "商城",
          tabBarIcon: tabIcon("gift", "gift-outline")
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "我的",
          tabBarIcon: tabIcon("person", "person-outline")
        }}
      />
    </Tabs>
  );
}
