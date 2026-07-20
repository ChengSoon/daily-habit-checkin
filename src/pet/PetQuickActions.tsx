import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { useTheme } from "../ui/ThemeContext";
import type { PetQuickAction } from "./petInteractionState";

type IconName = keyof typeof Ionicons.glyphMap;

export function PetQuickActions({
  visible,
  onAction
}: {
  visible: boolean;
  onAction: (action: PetQuickAction) => void;
}) {
  const { colors } = useTheme();
  if (!visible) return null;

  const actions: {
    action: PetQuickAction;
    icon: IconName;
    label: string;
    background: string;
    color: string;
  }[] = [
    {
      action: "chat",
      icon: "chatbubble-ellipses-outline",
      label: "和卡卡聊聊",
      background: colors.partnerSurface,
      color: colors.partnerInk
    },
    {
      action: "mood",
      icon: "heart-outline",
      label: "记录心情",
      background: colors.candySkySurface,
      color: colors.candySkyInk
    },
    {
      action: "encouragement",
      icon: "sparkles-outline",
      label: "给我一点动力",
      background: colors.candySunSurface,
      color: colors.candySunInk
    },
    {
      action: "reflection",
      icon: "book-outline",
      label: "回顾今天",
      background: colors.successSurface,
      color: colors.candyMintInk
    }
  ];

  return (
    <View
      accessibilityRole="toolbar"
      style={{
        width: 202,
        height: 54,
        paddingHorizontal: 7,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.line,
        shadowColor: colors.ink,
        shadowOpacity: 0.14,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 5
      }}
    >
      {actions.map((item) => (
        <Pressable
          key={item.action}
          onPress={() => onAction(item.action)}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: item.background,
            opacity: pressed ? 0.78 : 1,
            transform: [{ scale: pressed ? 0.94 : 1 }]
          })}
        >
          <Ionicons name={item.icon} size={19} color={item.color} />
        </Pressable>
      ))}
    </View>
  );
}
