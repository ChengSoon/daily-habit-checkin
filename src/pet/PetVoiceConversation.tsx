import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { AppText } from "../ui/Controls";
import { useTheme } from "../ui/ThemeContext";
import type { VoiceConversationPhase } from "./voiceConversationState";
import { PetSprite } from "./PetSprite";

function statusForPhase(phase: VoiceConversationPhase): string {
  if (phase === "requesting") return "正在准备麦克风";
  if (phase === "listening") return "我在听";
  if (phase === "thinking") return "卡卡正在想";
  if (phase === "speaking") return "卡卡在回答";
  if (phase === "error") return "语音暂时停住了";
  return "语音对话";
}

function iconForPhase(
  phase: VoiceConversationPhase
): keyof typeof Ionicons.glyphMap {
  if (phase === "thinking") return "ellipsis-horizontal";
  if (phase === "speaking") return "volume-high";
  if (phase === "error") return "refresh";
  return "mic";
}

export function PetVoiceConversation({
  phase,
  transcript,
  errorMessage,
  volume,
  onInterrupt,
  onStop
}: {
  phase: VoiceConversationPhase;
  transcript: string;
  errorMessage: string | null;
  volume: number;
  onInterrupt: () => void;
  onStop: () => void;
}) {
  const { colors } = useTheme();
  const interactive = phase === "speaking" || phase === "error";
  const normalizedVolume = Math.max(0.16, Math.min(1, (volume + 2) / 12));
  const mood = phase === "thinking" ? "thinking" : phase === "speaking" ? "happy" : "waiting";

  return (
    <View
      style={{
        minHeight: 390,
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 8,
        alignItems: "center",
        justifyContent: "space-between"
      }}
    >
      <View style={{ alignItems: "center", gap: 4, minHeight: 66 }} accessibilityLiveRegion="polite">
        <AppText variant="section">{statusForPhase(phase)}</AppText>
        <AppText
          tone={errorMessage ? "danger" : "muted"}
          style={{ textAlign: "center", minHeight: 24 }}
          numberOfLines={2}
        >
          {errorMessage ?? transcript ?? ""}
        </AppText>
      </View>

      <Pressable
        onPress={onInterrupt}
        disabled={!interactive}
        accessibilityRole="button"
        accessibilityLabel={phase === "speaking" ? "打断卡卡并继续说" : "重试语音识别"}
        style={({ pressed }) => ({
          width: 184,
          height: 184,
          borderRadius: 92,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: phase === "error" ? colors.dangerSurface : colors.successSurface,
          borderWidth: 3,
          borderColor: phase === "error" ? colors.danger : colors.success,
          opacity: pressed ? 0.82 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }]
        })}
      >
        <PetSprite mood={mood} size={94} />
        <View
          style={{
            position: "absolute",
            right: 14,
            bottom: 18,
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.line
          }}
        >
          <Ionicons
            name={iconForPhase(phase)}
            size={19}
            color={phase === "error" ? colors.danger : colors.candyMintInk}
          />
        </View>
      </Pressable>

      <View style={{ height: 34, flexDirection: "row", alignItems: "center", gap: 5 }}>
        {[0.52, 0.78, 1, 0.7, 0.46].map((factor, index) => (
          <View
            key={index}
            style={{
              width: 5,
              height: Math.max(6, 30 * factor * (phase === "listening" ? normalizedVolume : 0.38)),
              borderRadius: 3,
              backgroundColor: phase === "error" ? colors.danger : colors.success
            }}
          />
        ))}
      </View>

      <Pressable
        onPress={onStop}
        accessibilityRole="button"
        accessibilityLabel="结束语音对话"
        style={({ pressed }) => ({
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.danger,
          opacity: pressed ? 0.8 : 1
        })}
      >
        <Ionicons name="close" size={26} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}
