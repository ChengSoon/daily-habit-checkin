import { Text, View } from "react-native";

export function ProgressHeader({ completed, total }: { completed: number; total: number }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 28, fontWeight: "800" }}>今日</Text>
      <Text style={{ color: "#555" }}>
        已完成 {completed}/{total}
      </Text>
    </View>
  );
}
