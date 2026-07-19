import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getPlanForHabit } from "../../src/ai/habitPlanRepository";
import { requestAIHabitPlan } from "../../src/ai/aiClient";
import { HABIT_ASSISTANT_SYSTEM, llmChatStream } from "../../src/ai/llmClient";
import {
  ChatEngineState,
  createInitialChatState,
  draftToRequest,
  reduceChat
} from "../../src/ai/chatEngine";
import { ChatEngineEffect, ChatMessage, QuickReply } from "../../src/ai/chatTypes";
import { listCheckInsForHabit } from "../../src/checkins/checkinRepository";
import { calculateCurrentStreak, calculateMonthlyCompletionRate } from "../../src/checkins/stats";
import { listActiveHabits, updateHabit } from "../../src/habits/habitRepository";
import { shouldRunOnDate } from "../../src/habits/habitRules";
import { AppText, Card } from "../../src/ui/Controls";
import { ThinkingDots } from "../../src/ui/ThinkingDots";
import { sceneTint } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeContext";
import { eachDateKey, todayKey } from "../../src/utils/date";
import { createId } from "../../src/utils/id";

async function loadHabitStats(habitId: string) {
  const habits = await listActiveHabits();
  const habit = habits.find((item) => item.id === habitId);
  if (!habit) {
    throw new Error("习惯不存在或已暂停");
  }
  const checkIns = await listCheckInsForHabit(habitId);
  const today = todayKey();
  const habitStartDate = habit.createdAt.slice(0, 10);
  const isScheduled = (date: string) => shouldRunOnDate(habit.frequency, new Date(`${date}T00:00:00`));
  const allScheduledDates = eachDateKey(habitStartDate, today).filter(isScheduled);
  const recent7 = allScheduledDates.slice(-7);
  const currentStreak = calculateCurrentStreak({
    today,
    scheduledDates: allScheduledDates,
    checkIns
  });
  const completionRate7Days = calculateMonthlyCompletionRate({
    scheduledDates: recent7,
    checkIns
  });
  const plan = await getPlanForHabit(habitId);
  const planEnded = plan ? today > plan.endDate : false;
  return {
    habitId: habit.id,
    habitName: habit.name,
    completionRate7Days,
    currentStreak,
    planEnded,
    habit
  };
}

type StreamListItem = ChatMessage & {
  isStream?: boolean;
  phase?: "thinking" | "streaming";
};

export default function AiChatScreen() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [engine, setEngine] = useState<ChatEngineState>(() => createInitialChatState());
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamDraft, setStreamDraft] = useState<{
    id: string;
    text: string;
    phase: "thinking" | "streaming";
  } | null>(null);
  const listRef = useRef<FlatList<StreamListItem>>(null);
  const applying = useRef(false);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [engine.messages.length, streamDraft?.text, streamDraft?.phase, scrollToEnd]);

  const runEffects = useCallback(async (effects: ChatEngineEffect[], base: ChatEngineState) => {
    let current = base;
    for (const effect of effects) {
      if (effect.type === "generate_plan") {
        setBusy(true);
        setStreamDraft({ id: createId("stream"), text: "", phase: "thinking" });
        try {
          const plan = await requestAIHabitPlan(draftToRequest(effect.draft));
          setStreamDraft(null);
          const result = reduceChat(current, {
            type: "plan_generated",
            plan,
            draft: effect.draft
          });
          current = result.state;
          engineRef.current = current;
          setEngine(current);
        } catch (error) {
          setStreamDraft(null);
          const message = error instanceof Error ? error.message : "生成失败";
          const result = reduceChat(current, { type: "plan_failed", error: message });
          current = result.state;
          engineRef.current = current;
          setEngine(current);
        } finally {
          setBusy(false);
        }
        continue;
      }

      if (effect.type === "llm_chat") {
        setBusy(true);
        const streamId = createId("stream");
        setStreamDraft({ id: streamId, text: "", phase: "thinking" });
        try {
          const history = current.messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .slice(-12)
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.text }));
          const reply = await llmChatStream(
            [{ role: "system", content: HABIT_ASSISTANT_SYSTEM }, ...history],
            {
              onDelta: (chunk) => {
                setStreamDraft((prev) => {
                  const base = prev ?? { id: streamId, text: "", phase: "thinking" as const };
                  return {
                    id: base.id,
                    text: `${base.text}${chunk}`,
                    phase: "streaming"
                  };
                });
              }
            }
          );
          setStreamDraft(null);
          const result = reduceChat(current, { type: "llm_replied", text: reply.trim() });
          current = result.state;
          engineRef.current = current;
          setEngine(current);
        } catch (error) {
          setStreamDraft(null);
          const message = error instanceof Error ? error.message : "模型调用失败";
          const result = reduceChat(current, { type: "llm_failed", error: message });
          current = result.state;
          engineRef.current = current;
          setEngine(current);
        } finally {
          setBusy(false);
        }
        continue;
      }

      if (effect.type === "load_habits") {
        const habits = await listActiveHabits();
        const result = reduceChat(current, {
          type: "habits_loaded",
          habits: habits.map((h) => ({ id: h.id, name: h.name }))
        });
        current = result.state;
        engineRef.current = current;
          setEngine(current);
        continue;
      }

      if (effect.type === "load_habit_stats") {
        try {
          const stats = await loadHabitStats(effect.habitId);
          const result = reduceChat(current, {
            type: "stats_loaded",
            stats: {
              habitId: stats.habitId,
              habitName: stats.habitName,
              completionRate7Days: stats.completionRate7Days,
              currentStreak: stats.currentStreak,
              planEnded: stats.planEnded
            }
          });
          current = result.state;
          engineRef.current = current;
          setEngine(current);
        } catch (error) {
          const message = error instanceof Error ? error.message : "分析失败";
          const result = reduceChat(current, {
            type: "suggestion_applied",
            message
          });
          current = result.state;
          engineRef.current = current;
          setEngine(current);
        }
        continue;
      }

      if (effect.type === "apply_suggestion") {
        if (applying.current) continue;
        applying.current = true;
        try {
          const { habit } = await loadHabitStats(effect.habitId);
          if (effect.actionLabel === "调整计划") {
            const nextDescription = habit.description
              ? `${habit.description}（已根据完成情况调轻：先缩短任务，降低启动压力）`
              : "已根据完成情况调轻：先缩短任务，降低启动压力";
            await updateHabit(habit.id, {
              name: habit.name,
              description: nextDescription,
              frequency: habit.frequency,
              reminderTime: habit.reminderTime,
              isReminderEnabled: habit.isReminderEnabled,
              trackType: habit.trackType,
              numericUnit: habit.numericUnit
            });
            const result = reduceChat(current, {
              type: "suggestion_applied",
              message: `已为「${habit.name}」应用调轻建议。可在习惯详情继续微调。`
            });
            current = result.state;
            engineRef.current = current;
          setEngine(current);
          } else if (effect.actionLabel === "生成下一阶段") {
            const result = reduceChat(current, {
              type: "suggestion_applied",
              message: `「${habit.name}」的计划已结束。可以说出下一阶段目标，我帮你生成新计划。`
            });
            current = result.state;
            engineRef.current = current;
          setEngine(current);
          } else {
            const result = reduceChat(current, {
              type: "suggestion_applied",
              message: `好的，继续保持「${habit.name}」当前节奏。`
            });
            current = result.state;
            engineRef.current = current;
          setEngine(current);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "应用失败";
          const result = reduceChat(current, { type: "suggestion_applied", message });
          current = result.state;
          engineRef.current = current;
          setEngine(current);
        } finally {
          applying.current = false;
        }
      }
    }
  }, []);

  const dispatch = useCallback(
    async (inputArg: Parameters<typeof reduceChat>[1]) => {
      if (
        busy &&
        inputArg.type !== "plan_generated" &&
        inputArg.type !== "plan_failed" &&
        inputArg.type !== "reset" &&
        inputArg.type !== "llm_replied" &&
        inputArg.type !== "llm_failed"
      ) {
        return;
      }
      const result = reduceChat(engineRef.current, inputArg);
      engineRef.current = result.state;
      setEngine(result.state);
      if (result.effects.length > 0) {
        await runEffects(result.effects, result.state);
      }
    },
    [busy, runEffects]
  );

  async function sendText() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await dispatch({ type: "text", text });
  }

  async function onReply(reply: QuickReply) {
    if (busy) return;
    await dispatch({
      type: "reply",
      replyId: reply.id,
      value: reply.value ?? reply.label,
      label: reply.label
    });
  }

  function openPlanPreview(message: ChatMessage) {
    if (!message.planCard) return;
    const { plan, goalText, frequencyType, weeklyDays } = message.planCard;
    router.push({
      pathname: "/plan-preview",
      params: {
        plan: JSON.stringify(plan),
        goalText,
        frequencyType,
        weeklyDays: weeklyDays.join(",")
      }
    });
  }

  const latestQuickReplies =
    [...engine.messages].reverse().find((m) => m.role === "assistant" && m.quickReplies?.length)?.quickReplies ??
    [];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 10, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 13,
                backgroundColor: colors.partnerSurface,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Ionicons name="sparkles" size={18} color={colors.partnerInk} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="title">AI 助手</AppText>
              <AppText variant="small" tone="muted">
                生成计划 · 调整建议
              </AppText>
            </View>
            <Pressable
              onPress={() => {
                setStreamDraft(null);
                void dispatch({ type: "reset" });
              }}
              hitSlop={8}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.surface,
                paddingHorizontal: 12,
                paddingVertical: 6
              }}
            >
              <AppText variant="small" tone="soft">
                新对话
              </AppText>
            </Pressable>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={
            streamDraft
              ? ([
                  ...engine.messages,
                  {
                    id: streamDraft.id,
                    role: "assistant" as const,
                    text: streamDraft.text,
                    createdAt: Date.now(),
                    isStream: true,
                    phase: streamDraft.phase
                  }
                ] as StreamListItem[])
              : (engine.messages as StreamListItem[])
          }
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 10 }}
          onContentSizeChange={scrollToEnd}
          renderItem={({ item }: { item: StreamListItem }) => (
            <MessageBubble
              message={item}
              onOpenPlan={() => openPlanPreview(item)}
              onReply={onReply}
              busy={busy}
              thinking={Boolean(item.isStream && item.phase === "thinking")}
              streaming={Boolean(item.isStream && item.phase === "streaming")}
            />
          )}
        />

        {latestQuickReplies.length > 0 && !busy ? (
          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: 8,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8
            }}
          >
            {latestQuickReplies.map((reply) => (
              <Pressable
                key={reply.id}
                disabled={busy}
                onPress={() => onReply(reply)}
                style={{
                  borderRadius: 999,
                  backgroundColor: colors.partnerSurface,
                  borderWidth: 1,
                  borderColor: colors.line,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  opacity: busy ? 0.5 : 1
                }}
              >
                <AppText variant="small" style={{ color: colors.partnerInk, fontWeight: "800" }}>
                  {reply.label}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.line,
            backgroundColor: colors.surface,
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 10)
          }}
        >
          {busy ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                minHeight: 48,
                borderRadius: 18,
                backgroundColor: colors.partnerSurface,
                borderWidth: 1,
                borderColor: colors.line,
                paddingHorizontal: 14,
                paddingVertical: 12
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Ionicons
                  name={streamDraft?.phase === "streaming" ? "sparkles" : "hourglass-outline"}
                  size={16}
                  color={colors.partnerInk}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <ThinkingDots
                  variant="bar"
                  label={streamDraft?.phase === "streaming" ? "正在回复" : "思考中"}
                />
                <AppText variant="small" tone="muted" style={{ fontSize: 12, lineHeight: 16 }}>
                  {streamDraft?.phase === "streaming" ? "内容生成中，请稍候" : "正在理解你的问题"}
                </AppText>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="和 AI 聊聊，或点下方快捷项"
                placeholderTextColor={colors.faint}
                multiline
                style={{
                  flex: 1,
                  minHeight: 44,
                  maxHeight: 120,
                  borderRadius: 18,
                  backgroundColor: colors.inputBackground,
                  borderWidth: 1,
                  borderColor: colors.line,
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  color: colors.ink,
                  fontSize: 15,
                  fontFamily: "Nunito_500Medium"
                }}
              />
              <Pressable
                onPress={sendText}
                disabled={!input.trim()}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 15,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: !input.trim() ? colors.lineStrong : colors.primary
                }}
              >
                <Ionicons
                  name="send"
                  size={18}
                  color={!input.trim() ? colors.muted : colors.onPrimary}
                />
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({
  message,
  onOpenPlan,
  onReply,
  busy,
  thinking = false,
  streaming = false
}: {
  message: ChatMessage & { isStream?: boolean; phase?: "thinking" | "streaming" };
  onOpenPlan: () => void;
  onReply: (reply: QuickReply) => void;
  busy: boolean;
  thinking?: boolean;
  streaming?: boolean;
}) {
  const { colors, scheme } = useTheme();
  const isUser = message.role === "user";

  return (
    <View style={{ alignItems: isUser ? "flex-end" : "flex-start" }}>
      <View
        style={{
          maxWidth: "88%",
          borderRadius: 18,
          borderBottomRightRadius: isUser ? 6 : 18,
          borderBottomLeftRadius: isUser ? 18 : 6,
          backgroundColor: isUser ? colors.primary : colors.surface,
          borderWidth: isUser ? 0 : 1,
          borderColor: colors.line,
          paddingHorizontal: 14,
          paddingVertical: 10,
          gap: 8
        }}
      >
        {thinking ? (
          <View style={{ gap: 6, minWidth: 120 }}>
            <ThinkingDots label="思考中" variant="bubble" />
            <AppText variant="small" tone="muted" style={{ fontSize: 12 }}>
              正在组织回答
            </AppText>
          </View>
        ) : (
          <AppText variant="body" style={{ color: isUser ? colors.onPrimary : colors.ink }}>
            {streaming ? `${message.text}▍` : message.text}
          </AppText>
        )}

        {message.planCard ? (
          <Card {...sceneTint("lavender", scheme)} elevated={false} style={{ gap: 8, marginTop: 2 }}>
            <AppText variant="caption" style={{ color: colors.partnerInk, textTransform: "none" }}>
              AI 计划
            </AppText>
            <AppText variant="bodyStrong">{message.planCard.plan.habitName}</AppText>
            <AppText variant="small" tone="muted" numberOfLines={3}>
              {message.planCard.plan.description}
            </AppText>
            <AppText variant="small" tone="soft">
              {message.planCard.plan.durationDays} 天 · 提醒 {message.planCard.plan.recommendedReminderTime}
            </AppText>
            <Pressable
              onPress={onOpenPlan}
              style={{
                alignSelf: "flex-start",
                borderRadius: 999,
                backgroundColor: colors.surface,
                paddingHorizontal: 12,
                paddingVertical: 8
              }}
            >
              <AppText variant="small" style={{ color: colors.partnerInk, fontWeight: "800" }}>
                预览并导入
              </AppText>
            </Pressable>
          </Card>
        ) : null}

        {message.suggestionCard ? (
          <Card {...sceneTint("sky", scheme)} elevated={false} style={{ gap: 6, marginTop: 2 }}>
            <AppText variant="caption" style={{ color: colors.candySkyInk, textTransform: "none" }}>
              调整建议 · {message.suggestionCard.habitName}
            </AppText>
            <AppText variant="bodyStrong">{message.suggestionCard.title}</AppText>
            <AppText variant="small" tone="muted">
              {message.suggestionCard.body}
            </AppText>
            {!busy ? (
              <Pressable
                onPress={() =>
                  onReply({
                    id: "apply_suggestion",
                    label: message.suggestionCard!.actionLabel,
                    value: `${message.suggestionCard!.habitId}|${message.suggestionCard!.actionLabel}`
                  })
                }
                style={{
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  backgroundColor: colors.surface,
                  paddingHorizontal: 12,
                  paddingVertical: 8
                }}
              >
                <AppText variant="small" style={{ color: colors.candySkyInk, fontWeight: "800" }}>
                  {message.suggestionCard.actionLabel}
                </AppText>
              </Pressable>
            ) : null}
          </Card>
        ) : null}
      </View>
    </View>
  );
}

