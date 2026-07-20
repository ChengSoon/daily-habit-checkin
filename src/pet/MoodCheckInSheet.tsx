import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton, AppText } from "../ui/Controls";
import { useTheme } from "../ui/ThemeContext";
import { normalizeMoodCheckIn, type MoodScore } from "./moodCheckIn";
import { PetSprite } from "./PetSprite";

const MOODS: {
  score: MoodScore;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { score: 1, label: "很低", icon: "rainy-outline" },
  { score: 2, label: "低落", icon: "sad-outline" },
  { score: 3, label: "平静", icon: "remove-circle-outline" },
  { score: 4, label: "不错", icon: "happy-outline" },
  { score: 5, label: "很好", icon: "sunny-outline" }
];

export function MoodCheckInSheet({
  visible,
  busy,
  onClose,
  onSubmit
}: {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (score: MoodScore, note: string) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [score, setScore] = useState<MoodScore>(3);
  const [note, setNote] = useState("");

  function submit() {
    const normalized = normalizeMoodCheckIn(score, note);
    onSubmit(normalized.score, normalized.note);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "flex-end" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} />
        <View
          style={{
            width: "100%",
            maxWidth: 560,
            alignSelf: "center",
            backgroundColor: colors.surface,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.line,
            paddingHorizontal: 18,
            paddingTop: 14,
            paddingBottom: Math.max(insets.bottom, 14),
            gap: 14
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <PetSprite mood={score <= 2 ? "sad" : score >= 4 ? "happy" : "waiting"} size={48} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="section">现在心情怎么样？</AppText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="people-outline" size={13} color={colors.muted} />
                <AppText variant="caption" tone="muted">共同心情 · 双方可见</AppText>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="关闭心情签到"
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: 6 }}>
            {MOODS.map((mood) => {
              const selected = mood.score === score;
              return (
                <Pressable
                  key={mood.score}
                  onPress={() => setScore(mood.score)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`心情${mood.label}`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 62,
                    borderRadius: 8,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? colors.primary : colors.line,
                    backgroundColor: selected ? colors.surfaceTint : colors.surfaceMuted,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3
                  }}
                >
                  <Ionicons
                    name={mood.icon}
                    size={20}
                    color={selected ? colors.primaryInk : colors.inkSoft}
                  />
                  <AppText
                    variant="caption"
                    numberOfLines={1}
                    style={{ color: selected ? colors.primaryInk : colors.muted, fontSize: 10 }}
                  >
                    {mood.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={500}
            multiline
            editable={!busy}
            placeholder="想说的话（可选）"
            placeholderTextColor={colors.faint}
            style={{
              minHeight: 78,
              maxHeight: 130,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.inputBackground,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: colors.ink,
              fontFamily: "Nunito_500Medium",
              fontSize: 15,
              textAlignVertical: "top"
            }}
          />
          <AppButton
            title={busy ? "卡卡正在听…" : "让卡卡听听"}
            icon="heart-outline"
            fullWidth
            disabled={busy}
            onPress={submit}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
