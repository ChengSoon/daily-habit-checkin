import { Ionicons } from "@expo/vector-icons";
import { RefObject } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../ui/Controls";
import { ThinkingDots } from "../ui/ThinkingDots";
import { useTheme } from "../ui/ThemeContext";
import type { CompanionMessage } from "./companionTypes";
import { memoryActionForMessage } from "./companionMemoryView";
import { PET_NAME } from "./petIdentity";
import { PetChatComposer } from "./PetChatComposer";
import { PetSprite } from "./PetSprite";
import { PetVoiceConversation } from "./PetVoiceConversation";
import type { VoiceConversationPhase } from "./voiceConversationState";

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
  currentAccountId: string | null;
  executingActionId: string | null;
  onConfirmAction: (message: CompanionMessage) => void;
  onCancelAction: (message: CompanionMessage) => void;
  voiceActive: boolean;
  voicePhase: VoiceConversationPhase;
  voiceTranscript: string;
  voiceErrorMessage: string | null;
  voiceVolume: number;
  onStartVoice: () => void;
  onInterruptVoice: () => void;
  onStopVoice: () => void;
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
  onConfirmMemory,
  currentAccountId,
  executingActionId,
  onConfirmAction,
  onCancelAction,
  voiceActive,
  voicePhase,
  voiceTranscript,
  voiceErrorMessage,
  voiceVolume,
  onStartVoice,
  onInterruptVoice,
  onStopVoice
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
              disabled={busy || clearing || loading || voiceActive}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="开启新对话"
              accessibilityHint="清空双方可见的近期共同对话并开始新的对话"
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={busy || clearing || loading || voiceActive ? colors.line : colors.muted}
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

          {voiceActive ? (
            <PetVoiceConversation
              phase={voicePhase}
              transcript={voiceTranscript}
              errorMessage={voiceErrorMessage}
              volume={voiceVolume}
              onInterrupt={onInterruptVoice}
              onStop={onStopVoice}
            />
          ) : (
            <>
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
                  {item.action ? (
                    <View
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: mine ? colors.onPrimary : colors.line,
                        marginTop: 7,
                        paddingTop: 8,
                        gap: 7
                      }}
                    >
                      <AppText
                        variant="caption"
                        style={{ color: mine ? colors.onPrimary : colors.muted, fontWeight: "700" }}
                      >
                        {item.action.status === "pending"
                          ? "等待你的确认"
                          : item.action.status === "succeeded"
                            ? "已执行"
                            : item.action.status === "cancelled"
                              ? "已取消"
                              : item.action.status === "expired"
                                ? "已过期"
                                : "未完成"}
                      </AppText>
                      {item.action.status === "pending" &&
                      item.action.requestedBy === currentAccountId ? (
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Pressable
                            onPress={() => onConfirmAction(item)}
                            disabled={executingActionId === item.action.id}
                            accessibilityRole="button"
                            accessibilityLabel="确认执行卡卡动作"
                            style={{
                              flex: 1,
                              backgroundColor: mine ? colors.onPrimary : colors.primary,
                              borderRadius: 8,
                              paddingVertical: 7,
                              alignItems: "center"
                            }}
                          >
                            <AppText
                              variant="caption"
                              style={{ color: mine ? colors.primary : colors.onPrimary, fontWeight: "800" }}
                            >
                              {executingActionId === item.action.id ? "处理中…" : "确认执行"}
                            </AppText>
                          </Pressable>
                          <Pressable
                            onPress={() => onCancelAction(item)}
                            disabled={executingActionId === item.action.id}
                            accessibilityRole="button"
                            accessibilityLabel="取消卡卡动作"
                            style={{
                              flex: 1,
                              borderWidth: 1,
                              borderColor: mine ? colors.onPrimary : colors.line,
                              borderRadius: 8,
                              paddingVertical: 7,
                              alignItems: "center"
                            }}
                          >
                            <AppText
                              variant="caption"
                              style={{ color: mine ? colors.onPrimary : colors.muted, fontWeight: "800" }}
                            >
                              取消
                            </AppText>
                          </Pressable>
                        </View>
                      ) : null}
                      {item.action.resultMessage && item.action.status !== "pending" ? (
                        <AppText
                          variant="caption"
                          style={{ color: mine ? colors.onPrimary : colors.muted, lineHeight: 18 }}
                        >
                          {item.action.resultMessage}
                        </AppText>
                      ) : null}
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

              <PetChatComposer
                input={input}
                busy={busy}
                clearing={clearing}
                onChangeInput={onChangeInput}
                onSend={onSend}
                onStartVoice={onStartVoice}
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
