import { Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito";
import { Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold, useFonts } from "@expo-google-fonts/outfit";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initializeDatabase } from "../src/db/database";
import { configureNotificationHandler, refreshScheduledReminders } from "../src/reminders/reminderService";
import { GlobalPet, PetProvider } from "../src/pet";
import { AppSplash } from "../src/ui/AppSplash";
import { ThemeProvider, useTheme } from "../src/ui/ThemeContext";

// 等字体与品牌开屏就绪后再隐藏原生 splash，避免白屏闪一下。
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function ThemedStack() {
  const { colors, scheme } = useTheme();

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: "700", fontSize: 17 },
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
        <Stack.Screen name="shop/index" options={{ headerShown: false }} />
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
  const [splashVisible, setSplashVisible] = useState(true);
  const fontsReady = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    configureNotificationHandler();
    void initializeDatabase()
      .then(() => refreshScheduledReminders())
      .catch((error) => {
        console.warn("Failed to initialize app reminders", error);
      });
  }, []);

  useEffect(() => {
    if (!fontsReady) {
      return;
    }
    // 字体就绪后立刻藏原生 splash，交给品牌开屏接棒。
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsReady]);

  const handleSplashFinish = useCallback(() => {
    setSplashVisible(false);
  }, []);

  // 字体未就绪先不渲染业务树（保持原生 splash）；加载出错则照常渲染，回退系统字体。
  if (!fontsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ThemeProvider>
          <PetProvider>
            <View style={styles.flex}>
              <ThemedStack />
              <GlobalPet />
              <AppSplash visible={splashVisible} onFinish={handleSplashFinish} />
            </View>
          </PetProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }
});
