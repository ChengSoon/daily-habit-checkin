import { Ionicons } from "@expo/vector-icons";
import { RefObject } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../ui/Controls";
import { ThinkingDots } from "../ui/ThinkingDots";
import { useTheme } from "../ui/ThemeContext";
import { PET_NAME } from "./petPersona";
import { PetSprite } from "./PetSprite";
import type { PetChatMessage } from "./types";

type PetChatPanelProps = {
  visible: boolean;
  onClose: () => void;
  messages: PetChatMessage[];
  listRef: RefObject<FlatList<PetChatMessage> | null>;
  input: string;
  onChangeInput: (text: string) => void;
  onSend: () => void;
  busy: boolean;
  streamText: string;
};

export function PetChatPanel({
  visible,
  onClose,
  messages,
  listRef,
  input,
  onChangeInput,
  onSend,
  busy,
  streamText
}: PetChatPanelProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "flex-end" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderTopWidth: 1,
            borderColor: colors.line,
            paddingBottom: Math.max(insets.bottom, 12),
            maxHeight: "72%"
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 10,
              gap: 10
            }}
          >
            <PetSprite mood={busy ? "thinking" : "waiting"} size={48} />
            <View style={{ flex: 1 }}>
              <AppText style={{ fontWeight: "800", color: colors.ink }}>{PET_NAME}</AppText>
              <AppText variant="small" style={{ color: colors.muted, fontWeight: "600" }}>
                今天也在你身边
              </AppText>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="关闭卡卡对话"
            >
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}
            style={{ minHeight: 180, maxHeight: 320 }}
            ListEmptyComponent={
              <AppText variant="small" style={{ color: colors.muted, paddingVertical: 12 }}>
                今天过得怎么样？
              </AppText>
            }
            renderItem={({ item }) => {
              const mine = item.role === "user";
              return (
                <View
                  style={{
                    alignSelf: mine ? "flex-end" : "flex-start",
                    backgroundColor: mine ? colors.primary : colors.surfaceMuted,
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    maxWidth: "88%"
                  }}
                >
                  <AppText
                    style={{
                      color: mine ? colors.onPrimary : colors.ink,
                      fontWeight: "600",
                      lineHeight: 20
                    }}
                  >
                    {item.text}
                  </AppText>
                </View>
              );
            }}
            ListFooterComponent={
              busy ? (
                <View
                  style={{
                    alignSelf: "flex-start",
                    backgroundColor: colors.surfaceMuted,
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    maxWidth: "88%"
                  }}
                >
                  {streamText ? (
                    <AppText style={{ color: colors.ink, fontWeight: "600", lineHeight: 20 }}>
                      {streamText}
                    </AppText>
                  ) : (
                    <ThinkingDots label={`${PET_NAME} 思考中`} />
                  )}
                </View>
              ) : null
            }
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 16,
              paddingTop: 8
            }}
          >
            <TextInput
              value={input}
              onChangeText={onChangeInput}
              placeholder="跟卡卡说点什么…"
              placeholderTextColor={colors.faint}
              editable={!busy}
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
