import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/ui/ThemeContext";

type IoniconName = keyof typeof Ionicons.glyphMap;
type TabMotion = "adventure" | "drop" | "repeat" | "gift" | "person";

type TabIconProps = {
  active: IoniconName;
  color: ColorValue;
  focused: boolean;
  inactive: IoniconName;
  inactiveColor: string;
  motion: TabMotion;
  routeName: string;
  size: number;
};

type TabLabelProps = {
  color: ColorValue;
  focused: boolean;
  title: string;
};

type TabItem = {
  active: IoniconName;
  inactive: IoniconName;
  motion: TabMotion;
  name: string;
  title: string;
};

const shouldUseNativeDriver = Platform.OS !== "web";

const TAB_ITEMS: TabItem[] = [
  { active: "today", inactive: "today-outline", motion: "drop", name: "index", title: "今日" },
  { active: "repeat", inactive: "repeat-outline", motion: "repeat", name: "habits", title: "习惯" },
  { active: "map", inactive: "map-outline", motion: "adventure", name: "adventure", title: "闯关" },
  { active: "gift", inactive: "gift-outline", motion: "gift", name: "shop", title: "商城" },
  { active: "person", inactive: "person-outline", motion: "person", name: "profile", title: "我的" }
];

const tabPressHandlers = new Map<string, Set<() => void>>();

function emitTabPress(routeName: string) {
  tabPressHandlers.get(routeName)?.forEach((handler) => handler());
}

function subscribeTabPress(routeName: string, handler: () => void) {
  const handlers = tabPressHandlers.get(routeName) ?? new Set<() => void>();
  handlers.add(handler);
  tabPressHandlers.set(routeName, handlers);

  return () => {
    handlers.delete(handler);
    if (handlers.size === 0) {
      tabPressHandlers.delete(routeName);
    }
  };
}

function useTabFocusProgress(focused: boolean) {
  const [progress] = useState(() => new Animated.Value(focused ? 1 : 0));

  useEffect(() => {
    Animated.spring(progress, {
      toValue: focused ? 1 : 0,
      damping: 14,
      mass: 0.55,
      stiffness: 180,
      useNativeDriver: shouldUseNativeDriver
    }).start();
  }, [focused, progress]);

  return progress;
}

function playTabIconKick(kick: Animated.Value) {
  kick.stopAnimation(() => {
    kick.setValue(0);
    Animated.timing(kick, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: shouldUseNativeDriver
    }).start(({ finished }) => {
      if (finished) {
        kick.setValue(0);
      }
    });
  });
}

function useTabIconKick(routeName: string) {
  const [kick] = useState(() => new Animated.Value(0));

  useEffect(() => {
    return subscribeTabPress(routeName, () => playTabIconKick(kick));
  }, [kick, routeName]);

  return kick;
}

function getIconMotion(kick: Animated.Value, motion: TabMotion) {
  const baseScale = kick.interpolate({ inputRange: [0, 0.28, 0.68, 1], outputRange: [1, 1.18, 0.96, 1] });

  if (motion === "repeat") {
    return {
      rotate: kick.interpolate({ inputRange: [0, 0.38, 0.72, 1], outputRange: ["0deg", "-120deg", "24deg", "0deg"] }),
      scale: kick.interpolate({ inputRange: [0, 0.36, 0.72, 1], outputRange: [1, 1.16, 0.98, 1] }),
      translateX: kick.interpolate({ inputRange: [0, 0.38, 0.72, 1], outputRange: [0, 3, -1, 0] }),
      translateY: kick.interpolate({ inputRange: [0, 0.38, 0.72, 1], outputRange: [0, -5, 1, 0] })
    };
  }

  if (motion === "gift") {
    return {
      rotate: kick.interpolate({ inputRange: [0, 0.3, 0.58, 1], outputRange: ["0deg", "11deg", "-9deg", "0deg"] }),
      scale: kick.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: [1, 1.2, 0.98, 1] }),
      translateX: kick.interpolate({ inputRange: [0, 0.28, 0.56, 0.82, 1], outputRange: [0, -3, 3, -1, 0] }),
      translateY: kick.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: [0, -7, 2, 0] })
    };
  }

  if (motion === "adventure") {
    return {
      rotate: kick.interpolate({ inputRange: [0, 0.45, 1], outputRange: ["0deg", "-8deg", "0deg"] }),
      scale: kick.interpolate({ inputRange: [0, 0.34, 0.72, 1], outputRange: [1, 1.18, 0.96, 1] }),
      translateX: kick.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 4, 0] }),
      translateY: kick.interpolate({ inputRange: [0, 0.34, 0.72, 1], outputRange: [0, -7, 1, 0] })
    };
  }

  if (motion === "person") {
    return {
      rotate: kick.interpolate({ inputRange: [0, 0.34, 0.68, 1], outputRange: ["0deg", "-12deg", "7deg", "0deg"] }),
      scale: baseScale,
      translateX: kick.interpolate({ inputRange: [0, 0.34, 0.68, 1], outputRange: [0, -2, 1, 0] }),
      translateY: kick.interpolate({ inputRange: [0, 0.34, 0.68, 1], outputRange: [0, -6, 1, 0] })
    };
  }

  return {
    rotate: kick.interpolate({ inputRange: [0, 0.45, 1], outputRange: ["0deg", "0deg", "0deg"] }),
    scale: kick.interpolate({ inputRange: [0, 0.28, 0.68, 1], outputRange: [1, 1.18, 0.94, 1] }),
    translateX: kick.interpolate({ inputRange: [0, 1], outputRange: [0, 0] }),
    translateY: kick.interpolate({ inputRange: [0, 0.28, 0.68, 1], outputRange: [0, -8, 2, 0] })
  };
}

function AnimatedTabIcon({ active, color, focused, inactive, inactiveColor, motion, routeName, size }: TabIconProps) {
  const progress = useTabFocusProgress(focused);
  const kick = useTabIconKick(routeName);
  const activeOpacity = progress;
  const inactiveOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const motionStyle = getIconMotion(kick, motion);

  return (
    <Animated.View
      style={[
        styles.tabIconFrame,
        {
          transform: [
            { translateX: motionStyle.translateX },
            { translateY: motionStyle.translateY },
            { rotate: motionStyle.rotate },
            { scale: motionStyle.scale }
          ]
        }
      ]}
    >
      <Animated.View style={[styles.tabIconLayer, { opacity: inactiveOpacity }]}>
        <Ionicons name={inactive} size={size ?? 24} color={inactiveColor} />
      </Animated.View>
      <Animated.View style={[styles.tabIconLayer, { opacity: activeOpacity }]}>
        <Ionicons name={active} size={size ?? 24} color={String(color)} />
      </Animated.View>
    </Animated.View>
  );
}

function AnimatedTabLabel({ color, focused, title }: TabLabelProps) {
  const progress = useTabFocusProgress(focused);
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -1] });

  return (
    <Animated.Text style={[styles.tabLabel, { color: String(color), opacity, transform: [{ translateY }] }]}>
      {title}
    </Animated.Text>
  );
}

function tabIcon(active: IoniconName, inactive: IoniconName, inactiveColor: string, motion: TabMotion, routeName: string) {
  return function renderTabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return (
      <AnimatedTabIcon
        active={active}
        color={color}
        focused={focused}
        inactive={inactive}
        inactiveColor={inactiveColor}
        motion={motion}
        routeName={routeName}
        size={size}
      />
    );
  };
}

function tabLabel(title: string) {
  return function renderTabLabel({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <AnimatedTabLabel color={color} focused={focused} title={title} />;
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
          letterSpacing: 0,
          marginTop: Platform.OS === "ios" ? 2 : 0
        },
        tabBarIconStyle: { marginTop: 2 }
      }}
    >
      {TAB_ITEMS.map((item) => (
        <Tabs.Screen
          key={item.name}
          name={item.name}
          options={{
            title: item.title,
            tabBarIcon: tabIcon(item.active, item.inactive, colors.faint, item.motion, item.name),
            tabBarLabel: tabLabel(item.title)
          }}
          listeners={{
            tabPress: () => emitTabPress(item.name)
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconFrame: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    width: 42
  },
  tabIconLayer: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0,
    marginTop: Platform.OS === "ios" ? 2 : 0
  }
});
