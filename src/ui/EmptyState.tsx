import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { AppText } from "./Controls";
import { radius, spacing } from "./theme";
import { useTheme } from "./ThemeContext";

type IoniconName = keyof typeof Ionicons.glyphMap;

export function EmptyState({
  title,
  body,
  icon = "leaf-outline"
}: {
  title: string;
  body: string;
  icon?: IoniconName;
}) {
  const { colors } = useTheme();

  return (
    <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfaceTint
        }}
      >
        <Ionicons name={icon} size={30} color={colors.primaryInk} />
      </View>
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <AppText variant="section" style={{ textAlign: "center" }}>
          {title}
        </AppText>
        <AppText variant="body" tone="muted" style={{ textAlign: "center" }}>
          {body}
        </AppText>
      </View>
    </View>
  );
}
