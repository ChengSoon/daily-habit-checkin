import { onHabitsLoaded, onStatsLoaded } from "./chatAdjustmentFlow";
import {
  append,
  HOME_REPLIES,
  homeAssistant,
  msg,
  withFlow,
  type ChatEngineResult,
  type ChatEngineState
} from "./chatEngineShared";
import { handlePlanInput, startPlan } from "./chatPlanFlow";
import { ChatEngineInput, RequiredPlanDraft, toRequiredPlanDraft } from "./chatTypes";

export type { ChatEngineResult, ChatEngineState } from "./chatEngineShared";

export function createInitialChatState(): ChatEngineState {
  return { messages: [homeAssistant()], flow: { kind: "idle" } };
}

function startAdjust(state: ChatEngineState): ChatEngineResult {
  return {
    state: append(
      withFlow(state, { kind: "adjust", step: "pick_habit" }),
      msg("assistant", "好，我先看看你们岛上的习惯…")
    ),
    effects: [{ type: "load_habits" }]
  };
}

function handleIdleText(state: ChatEngineState, text: string): ChatEngineResult {
  const trimmed = text.trim();
  const next = append(state, msg("user", trimmed));
  if (!trimmed) return { state, effects: [] };
  if (/^(生成习惯计划|生成计划)$/.test(trimmed)) return startPlan(next);
  if (/^(调整现有习惯|调整计划|调整建议)$/.test(trimmed)) return startAdjust(next);
  if (/^(重新开始|重置)$/.test(trimmed)) return reduceChat(next, { type: "reset" });
  return { state: next, effects: [{ type: "llm_chat" }] };
}

function reduceLifecycleEvent(state: ChatEngineState, input: ChatEngineInput): ChatEngineResult | null {
  if (input.type === "boot") return { state: createInitialChatState(), effects: [] };
  if (input.type === "reset") {
    return {
      state: {
        messages: [...state.messages, homeAssistant("好，已回到起点。还需要什么？")],
        flow: { kind: "idle" }
      },
      effects: []
    };
  }
  return null;
}

function reducePlanEvent(state: ChatEngineState, input: ChatEngineInput): ChatEngineResult | null {
  if (input.type === "plan_generated") {
    const required = toRequiredPlanDraft(input.draft);
    return {
      state: append(
        withFlow(state, { kind: "idle" }),
        msg(
          "assistant",
          `已生成「${input.plan.habitName}」${input.plan.durationDays} 天计划。可以预览后导入小岛，也可以继续聊别的。`,
          {
            planCard: {
              plan: input.plan,
              goalText: required?.goalText ?? input.draft.goalText ?? "",
              frequencyType: required?.frequencyType ?? "daily",
              weeklyDays: required?.weeklyDays ?? []
            },
            quickReplies: HOME_REPLIES
          }
        )
      ),
      effects: []
    };
  }
  if (input.type === "plan_failed") {
    return {
      state: append(
        withFlow(state, { kind: "idle" }),
        msg("assistant", `生成失败：${input.error}\n可以检查「我的 → AI 服务配置」后重试。`, {
          quickReplies: [
            { id: "plan", label: "再试一次", value: "plan" },
            { id: "reset", label: "返回", value: "reset" }
          ]
        })
      ),
      effects: []
    };
  }
  return null;
}

function reduceResultEvent(state: ChatEngineState, input: ChatEngineInput): ChatEngineResult | null {
  if (input.type === "suggestion_applied") {
    return {
      state: append(withFlow(state, { kind: "idle" }), msg("assistant", input.message, { quickReplies: HOME_REPLIES })),
      effects: []
    };
  }
  if (input.type === "llm_replied") {
    return {
      state: append(withFlow(state, { kind: "idle" }), msg("assistant", input.text, { quickReplies: HOME_REPLIES })),
      effects: []
    };
  }
  if (input.type === "llm_failed") {
    return {
      state: append(
        withFlow(state, { kind: "idle" }),
        msg(
          "assistant",
          `模型调用失败：${input.error}\n请到「我的 → AI 服务配置」检查地址 / API Key / 模型名。`,
          { quickReplies: HOME_REPLIES }
        )
      ),
      effects: []
    };
  }
  return null;
}

function reduceSystemEvent(state: ChatEngineState, input: ChatEngineInput): ChatEngineResult | null {
  const lifecycle = reduceLifecycleEvent(state, input);
  if (lifecycle) return lifecycle;
  const plan = reducePlanEvent(state, input);
  if (plan) return plan;
  if (input.type === "habits_loaded") return onHabitsLoaded(state, input.habits);
  if (input.type === "stats_loaded") return onStatsLoaded(state, input.stats);
  return reduceResultEvent(state, input);
}

function reduceReply(state: ChatEngineState, input: Extract<ChatEngineInput, { type: "reply" }>): ChatEngineResult {
  const value = input.value;
  if (value === "reset" || input.replyId === "reset") return reduceChat(state, { type: "reset" });
  if (value === "plan" || input.replyId === "plan") {
    return startPlan(append(state, msg("user", "生成习惯计划")));
  }
  if (value === "adjust" || input.replyId === "adjust") {
    return startAdjust(append(state, msg("user", "调整现有习惯")));
  }
  if (input.replyId === "apply_suggestion" || value.includes("|")) {
    const [habitId, actionLabel] = value.split("|");
    if (habitId && actionLabel) {
      return {
        state: append(state, msg("user", actionLabel)),
        effects: [{ type: "apply_suggestion", habitId, actionLabel }]
      };
    }
  }
  if (state.flow.kind === "adjust" && state.flow.step === "pick_habit") {
    const next = append(state, msg("user", input.label ?? value));
    return {
      state: append(
        withFlow(next, { kind: "adjust", step: "pick_habit", habitId: value }),
        msg("assistant", "正在分析完成情况…")
      ),
      effects: [{ type: "load_habit_stats", habitId: value }]
    };
  }
  if (state.flow.kind === "plan") {
    return handlePlanInput({
      state,
      draft: state.flow.draft,
      step: state.flow.step,
      raw: value,
      displayText: input.label ?? value
    });
  }
  return handleIdleText(state, input.label ?? value);
}

export function reduceChat(state: ChatEngineState, input: ChatEngineInput): ChatEngineResult {
  const systemResult = reduceSystemEvent(state, input);
  if (systemResult) return systemResult;
  if (input.type === "reply") return reduceReply(state, input);
  if (input.type === "text") {
    if (state.flow.kind === "plan" && state.flow.step !== "generating") {
      return handlePlanInput({ state, draft: state.flow.draft, step: state.flow.step, raw: input.text });
    }
    if (state.flow.kind === "adjust") {
      return handleIdleText(append(state, msg("user", input.text)), "重新开始");
    }
    return handleIdleText(state, input.text);
  }
  return { state, effects: [] };
}

export function draftToRequest(draft: RequiredPlanDraft) {
  return {
    goalText: draft.goalText,
    currentLevel: draft.currentLevel,
    durationDays: draft.durationDays,
    dailyAvailableMinutes: draft.dailyAvailableMinutes,
    expectedFrequency: draft.frequencyType === "weekly"
      ? { type: "weekly" as const, daysOfWeek: draft.weeklyDays }
      : draft.frequencyType === "weekdays" ? { type: "weekdays" as const } : { type: "daily" as const },
    reminderPreference: draft.reminderPreference,
    customReminderTime: draft.customReminderTime,
    preferredTrackType: draft.preferredTrackType
  };
}
