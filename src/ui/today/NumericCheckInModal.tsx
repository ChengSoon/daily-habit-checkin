import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import type { Habit } from "../../habits/types";
import { AppButton, AppText, TextField } from "../Controls";
import { useTheme } from "../ThemeContext";

export function NumericCheckInModal({ habit, value, bottomInset, onChange, onCancel, onComplete }: {
  habit: Habit | null;
  value: string;
  bottomInset: number;
  onChange: (value: string) => void;
  onCancel: () => void;
  onComplete: (habit: Habit, value: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={habit !== null} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable accessibilityLabel="关闭输入" style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onCancel} />
        <View style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          padding: 16,
          paddingBottom: 16 + bottomInset,
          gap: 12
        }}>
          <View style={{ gap: 4 }}>
            <AppText variant="section">{habit?.name}</AppText>
            <AppText variant="body" tone="muted">
              记录今天的进度{habit?.numericUnit ? `（${habit.numericUnit}）` : ""}
            </AppText>
          </View>
          <TextField value={value} onChangeText={onChange} keyboardType="numeric" placeholder="输入数值" autoFocus />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <AppButton title="取消" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
            <AppButton
              title="完成"
              onPress={() => habit && onComplete(habit, Number(value))}
              disabled={!value || Number.isNaN(Number(value))}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
