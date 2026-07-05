import { Text, View } from "react-native";

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: 8, paddingVertical: 32 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: "#555" }}>{body}</Text>
    </View>
  );
}
