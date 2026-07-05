import { Stack } from "expo-router";
import { useEffect } from "react";
import { initializeDatabase } from "../src/db/database";
import { configureNotificationHandler } from "../src/reminders/reminderService";

export default function RootLayout() {
  useEffect(() => {
    initializeDatabase();
    configureNotificationHandler();
  }, []);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="habit/new" options={{ title: "新增习惯" }} />
      <Stack.Screen name="habit/[id]" options={{ title: "习惯详情" }} />
      <Stack.Screen name="plan-preview" options={{ title: "AI 计划预览" }} />
    </Stack>
  );
}
