import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerTitleAlign: "center" }}>
      <Tabs.Screen name="index" options={{ title: "今日" }} />
      <Tabs.Screen name="habits" options={{ title: "习惯" }} />
      <Tabs.Screen name="profile" options={{ title: "我的" }} />
    </Tabs>
  );
}
