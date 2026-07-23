import { Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito";
import { Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold, useFonts } from "@expo-google-fonts/outfit";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { AppState, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initializeDatabase } from "../src/db/database";
import { refreshAuthenticatedReminders } from "../src/reminders/reminderRefresh";
import { configureNotificationHandler } from "../src/reminders/reminderService";
import { GlobalPet, PetProvider } from "../src/pet";
import { AppSplash } from "../src/ui/AppSplash";
import { ThemeProvider, useTheme } from "../src/ui/ThemeContext";

function ThemedStack() {
  const { colors, scheme } = useTheme();

  useEffect(() => {
    // 避免原生导航容器默认黑底在转场间隙露出来
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background]);

  const screenOptions = {
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: "700", fontSize: 17 },
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          // 跨端统一推入感：Android 用 iOS 风格侧滑；web 不用 fade，避免露黑底
          animation: Platform.select<"default" | "ios_from_right">({
            ios: "default",
            android: "ios_from_right",
            default: "default"
          }),
          animationDuration: 280,
          gestureEnabled: true,
          // Android 全屏手势 + 自定义动画偶发空白页，仅 iOS 开启
          fullScreenGestureEnabled: Platform.OS === "ios"
  } as const;
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <AppRoutes screenOptions={screenOptions} />
    </>
  );
}

function AppRoutes({ screenOptions }: { screenOptions: React.ComponentProps<typeof Stack>["screenOptions"] }) {
  return (
    <Stack screenOptions={screenOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "none" }} />
        <Stack.Screen name="habit/new" options={{ title: "新增习惯" }} />
        <Stack.Screen name="habit/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="plan-preview"
          options={{ headerShown: false, animation: "slide_from_bottom", animationDuration: 320 }}
        />
        <Stack.Screen name="adventure/map" options={{ headerShown: false }} />
        <Stack.Screen name="adventure/badges" options={{ headerShown: false }} />
        <Stack.Screen name="adventure/[chapterId]" options={{ title: "章节" }} />
        <Stack.Screen
          name="shop/index"
          options={{ headerShown: false, animation: "slide_from_bottom", animationDuration: 320 }}
        />
        <Stack.Screen name="shop/redemptions" options={{ title: "兑换记录" }} />
        <Stack.Screen name="admin/adventure" options={{ title: "章节管理" }} />
        <Stack.Screen name="admin/adventure-claims" options={{ title: "章节兑现" }} />
        <Stack.Screen name="admin/rewards" options={{ title: "奖励管理" }} />
        <Stack.Screen name="admin/redemptions" options={{ title: "兑现管理" }} />
        <Stack.Screen
          name="account"
          options={{ headerShown: false, animation: "slide_from_bottom", animationDuration: 320 }}
        />
        <Stack.Screen
          name="companion-settings"
          options={{ headerShown: false, animation: "slide_from_bottom", animationDuration: 320 }}
        />
    </Stack>
  );
}

export default function RootLayout() {
  // 加载 board 同款字体：Outfit（标题/数字）+ Nunito（正文）。系统字体气质与设计稿差距大。
  useFonts({
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold
  });
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    configureNotificationHandler();
    void initializeDatabase()
      .then(async () => {
        await refreshAuthenticatedReminders();
      })
      .catch((error) => {
        console.warn("Failed to initialize app reminders", error);
      });

    // 回前台时重排本地提醒
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        void refreshAuthenticatedReminders().catch((error) => {
          console.warn("Failed to refresh reminders on foreground", error);
        });
      }
    });
    return () => sub.remove();
  }, []);

  const handleSplashFinish = useCallback(() => {
    setSplashVisible(false);
  }, []);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedAppShell splashVisible={splashVisible} onSplashFinish={handleSplashFinish} />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedAppShell({
  splashVisible,
  onSplashFinish
}: {
  splashVisible: boolean;
  onSplashFinish: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PetProvider>
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <ThemedStack />
        <GlobalPet />
        <AppSplash visible={splashVisible} onFinish={onSplashFinish} />
      </View>
    </PetProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#F3F4F8" }
});
