import { Ionicons } from "@expo/vector-icons";
import { View, ViewStyle } from "react-native";
import { AppText } from "./Controls";
import { useTheme } from "./ThemeContext";

type IoniconName = keyof typeof Ionicons.glyphMap;

/** board 风格空态：软圆图标芯片 + 居中标题/说明；fill 时撑满可用高度，避免页面只剩顶部一小块。 */
export function EmptyState({
  title,
  body,
  icon = "leaf-outline",
  fill = false,
  style
}: {
  title: string;
  body: string;
  icon?: IoniconName;
  fill?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          alignItems: "center",
          justifyContent: fill ? "center" : "flex-start",
          gap: 14,
          paddingVertical: fill ? 36 : 28,
          paddingHorizontal: 18,
          borderRadius: 20,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          minHeight: fill ? 280 : undefined,
          flex: fill ? 1 : undefined
        },
        style
      ]}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfaceTint
        }}
      >
        <Ionicons name={icon} size={32} color={colors.primaryInk} />
      </View>
      <View style={{ alignItems: "center", gap: 6, maxWidth: 280 }}>
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
