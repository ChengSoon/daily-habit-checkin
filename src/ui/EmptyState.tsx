import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { AppText } from "./Controls";
import { useTheme } from "./ThemeContext";

type IoniconName = keyof typeof Ionicons.glyphMap;

/** board 风格空态：软圆图标芯片 + 居中标题/说明 */
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
    <View
      style={{
        alignItems: "center",
        gap: 12,
        paddingVertical: 20,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfaceTint
        }}
      >
        <Ionicons name={icon} size={26} color={colors.primaryInk} />
      </View>
      <View style={{ alignItems: "center", gap: 4 }}>
        <AppText variant="section" style={{ textAlign: "center", fontFamily: "Outfit_700Bold" }}>
          {title}
        </AppText>
        <AppText variant="body" tone="muted" style={{ textAlign: "center" }}>
          {body}
        </AppText>
      </View>
    </View>
  );
}
