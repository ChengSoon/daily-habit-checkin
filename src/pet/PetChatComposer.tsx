import { Ionicons } from "@expo/vector-icons";
import { Pressable, TextInput, View } from "react-native";
import { useTheme } from "../ui/ThemeContext";

export function PetChatComposer({
  input,
  busy,
  clearing,
  onChangeInput,
  onSend,
  onStartVoice
}: {
  input: string;
  busy: boolean;
  clearing: boolean;
  onChangeInput: (text: string) => void;
  onSend: () => void;
  onStartVoice: () => void;
}) {
  const { colors } = useTheme();
  const disabled = busy || clearing;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 8
      }}
    >
      <Pressable
        onPress={onStartVoice}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="开始和卡卡语音对话"
        style={({ pressed }) => ({
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: disabled ? colors.line : colors.successSurface,
          opacity: pressed ? 0.76 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }]
        })}
      >
        <Ionicons name="mic" size={20} color={disabled ? colors.faint : colors.candyMintInk} />
      </Pressable>
      <TextInput
        value={input}
        onChangeText={onChangeInput}
        placeholder="跟卡卡说点什么…"
        placeholderTextColor={colors.faint}
        editable={!disabled}
        onSubmitEditing={onSend}
        style={{
          flex: 1,
          minHeight: 42,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.inputBackground,
          paddingHorizontal: 12,
          color: colors.ink,
          fontWeight: "600"
        }}
      />
      <Pressable
        onPress={onSend}
        disabled={busy || !input.trim()}
        accessibilityRole="button"
        accessibilityLabel="发送消息"
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: busy || !input.trim() ? colors.line : colors.partner
        }}
      >
        <Ionicons name="send" size={18} color={colors.onPartner} />
      </Pressable>
    </View>
  );
}
