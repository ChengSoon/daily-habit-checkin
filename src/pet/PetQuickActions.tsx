import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../ui/ThemeContext";
import type { PetQuickAction } from "./petInteractionState";

type IconName = keyof typeof Ionicons.glyphMap;

export function PetQuickActions({
  visible,
  onAction,
  wakeEnabled
}: {
  visible: boolean;
  onAction: (action: PetQuickAction) => void;
  wakeEnabled: boolean;
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
      action: "play",
      icon: "game-controller-outline",
      label: "和我玩一会儿",
      background: colors.partnerSurface,
      color: colors.partnerInk
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
    },
    {
      action: "breathing",
      icon: "leaf-outline",
      label: "陪我呼吸",
      background: colors.successSurface,
      color: colors.candyMintInk
    },
    {
      action: "voice_wake",
      icon: wakeEnabled ? "mic" : "mic-off",
      label: wakeEnabled ? "语音唤醒 · 开" : "语音唤醒 · 关",
      background: wakeEnabled ? colors.successSurface : colors.surfaceMuted,
      color: wakeEnabled ? colors.candyMintInk : colors.muted
    }
  ];

  return (
    <View
      accessibilityRole="toolbar"
      style={{
        width: 268,
        padding: 7,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 5,
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.line,
        shadowColor: colors.ink,
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
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
            width: 122,
            height: 43,
            borderRadius: 9,
            flexShrink: 0,
            flexDirection: "row",
            gap: 5,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: item.background,
            opacity: pressed ? 0.78 : 1,
            transform: [{ scale: pressed ? 0.94 : 1 }]
          })}
        >
          <Ionicons name={item.icon} size={19} color={item.color} />
          <Text style={{ color: item.color, fontSize: 11, fontWeight: "800" }}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
