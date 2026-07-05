import { View } from "react-native";
import { AppText } from "./Controls";
import { spacing } from "./theme";

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xxl }}>
      <AppText variant="section" style={{ textAlign: "center" }}>
        {title}
      </AppText>
      <AppText variant="body" tone="muted" style={{ textAlign: "center" }}>
        {body}
      </AppText>
    </View>
  );
}
