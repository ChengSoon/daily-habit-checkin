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
import type { CompanionMessage } from "./companionTypes";
import { memoryActionForMessage } from "./companionMemoryView";
import { PET_NAME } from "./petIdentity";
import { PetSprite } from "./PetSprite";

type PetChatPanelProps = {
  visible: boolean;
  onClose: () => void;
  messages: CompanionMessage[];
  listRef: RefObject<FlatList<CompanionMessage> | null>;
  input: string;
  onChangeInput: (text: string) => void;
  onSend: () => void;
  onNewConversation: () => void;
  busy: boolean;
  clearing: boolean;
  loading: boolean;
  streamText: string;
  savingMemoryId: string | null;
  onConfirmMemory: (message: CompanionMessage) => void;
};

export function PetChatPanel({
  visible,
  onClose,
  messages,
  listRef,
  input,
  onChangeInput,
  onSend,
  onNewConversation,
  busy,
  clearing,
  loading,
  streamText,
  savingMemoryId,
  onConfirmMemory
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
            <PetSprite mood={busy || clearing ? "thinking" : "waiting"} size={48} />
            <View style={{ flex: 1 }}>
              <AppText style={{ fontWeight: "800", color: colors.ink }}>{PET_NAME}</AppText>
              <AppText variant="small" style={{ color: colors.muted, fontWeight: "600" }}>
                共同对话 · 双方可见
              </AppText>
            </View>
            <Pressable
              onPress={onNewConversation}
              disabled={busy || clearing || loading}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="开启新对话"
              accessibilityHint="清空双方可见的近期共同对话并开始新的对话"
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={busy || clearing || loading ? colors.line : colors.muted}
              />
            </Pressable>
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
                {loading ? "正在加载共同对话…" : "这里还没有共同对话"}
              </AppText>
            }
            renderItem={({ item }) => {
              const mine = item.role === "user";
              const memoryAction = memoryActionForMessage(item);
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
                  {mine && item.senderName ? (
                    <AppText
                      variant="caption"
                      style={{ color: colors.onPrimary, opacity: 0.78, marginBottom: 2 }}
                    >
                      {item.senderName}
                    </AppText>
                  ) : null}
                  <AppText
                    style={{
                      color: mine ? colors.onPrimary : colors.ink,
                      fontWeight: "600",
                      lineHeight: 20
                    }}
                  >
                    {item.content}
                  </AppText>
                  {memoryAction ? (
                    <View
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: mine ? colors.onPrimary : colors.line,
                        marginTop: 7,
                        paddingTop: 7,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      <Ionicons
                        name={memoryAction === "confirmed" ? "checkmark-circle" : "heart-outline"}
                        size={15}
                        color={mine ? colors.onPrimary : colors.primary}
                      />
                      {memoryAction === "confirmed" ? (
                        <AppText
                          variant="caption"
                          style={{ color: mine ? colors.onPrimary : colors.muted, flex: 1 }}
                        >
                          已保存到共同记忆
                        </AppText>
                      ) : (
                        <Pressable
                          onPress={() => onConfirmMemory(item)}
                          disabled={savingMemoryId === item.id}
                          accessibilityRole="button"
                          accessibilityLabel="保存到共同记忆，双方可见"
                          style={{ flex: 1 }}
                        >
                          <AppText
                            variant="caption"
                            style={{ color: mine ? colors.onPrimary : colors.primary }}
                          >
                            {savingMemoryId === item.id
                              ? "正在保存…"
                              : "保存到共同记忆 · 双方可见"}
                          </AppText>
                        </Pressable>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            }}
            ListFooterComponent={
              busy || clearing ? (
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
                    <ThinkingDots label={clearing ? "正在开启新对话" : `${PET_NAME} 思考中`} />
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
              editable={!busy && !clearing}
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
