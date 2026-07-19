import { Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito";
import { Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold, useFonts } from "@expo-google-fonts/outfit";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initializeDatabase } from "../src/db/database";
import { configureNotificationHandler, refreshScheduledReminders } from "../src/reminders/reminderService";
import { ThemeProvider, useTheme } from "../src/ui/ThemeContext";

function ThemedStack() {
  const { colors, scheme } = useTheme();

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: "700" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background }
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="habit/new" options={{ title: "新增习惯" }} />
        <Stack.Screen name="habit/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="plan-preview" options={{ headerShown: false }} />
        <Stack.Screen name="adventure/map" options={{ headerShown: false }} />
        <Stack.Screen name="adventure/badges" options={{ headerShown: false }} />
        <Stack.Screen name="adventure/[chapterId]" options={{ title: "章节" }} />
        <Stack.Screen name="shop/redemptions" options={{ title: "兑换记录" }} />
        <Stack.Screen name="admin/adventure" options={{ title: "章节管理" }} />
        <Stack.Screen name="admin/adventure-claims" options={{ title: "章节兑现" }} />
        <Stack.Screen name="admin/rewards" options={{ title: "奖励管理" }} />
        <Stack.Screen name="admin/redemptions" options={{ title: "兑现管理" }} />
        <Stack.Screen name="account" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // 加载 board 同款字体：Outfit（标题/数字）+ Nunito（正文）。系统字体气质与设计稿差距大。
  const [fontsLoaded, fontError] = useFonts({
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold
  });

  useEffect(() => {
    configureNotificationHandler();
    void initializeDatabase()
      .then(() => refreshScheduledReminders())
      .catch((error) => {
        console.warn("Failed to initialize app reminders", error);
      });
  }, []);

  // 字体未就绪先不渲染（保持 splash）；加载出错则照常渲染，回退系统字体，避免卡死。
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedStack />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
