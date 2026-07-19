import { createId } from "../utils/id";
import {
  ChatEngineEffect,
  ChatEngineInput,
  ChatFlow,
  ChatMessage,
  CurrentLevel,
  FrequencyType,
  HabitOption,
  HabitStatsSnapshot,
  PlanDraft,
  PlanStep,
  QuickReply,
  ReminderPreference,
  RequiredPlanDraft,
  toRequiredPlanDraft
} from "./chatTypes";
import { getAdjustmentSuggestion } from "./adjustmentRules";
import { HabitTrackType } from "../habits/types";

export type ChatEngineState = {
  messages: ChatMessage[];
  flow: ChatFlow;
};

export type ChatEngineResult = {
  state: ChatEngineState;
  effects: ChatEngineEffect[];
};

function msg(
  role: "assistant" | "user",
  text: string,
  extras?: Partial<Pick<ChatMessage, "quickReplies" | "planCard" | "suggestionCard">>
): ChatMessage {
  return {
    id: createId("msg"),
    role,
    text,
    createdAt: Date.now(),
    ...extras
  };
}

function append(state: ChatEngineState, ...messages: ChatMessage[]): ChatEngineState {
  return { ...state, messages: [...state.messages, ...messages] };
}

function withFlow(state: ChatEngineState, flow: ChatFlow): ChatEngineState {
  return { ...state, flow };
}

const HOME_REPLIES: QuickReply[] = [
  { id: "plan", label: "生成习惯计划", value: "plan" },
  { id: "adjust", label: "调整现有习惯", value: "adjust" },
  { id: "reset", label: "重新开始", value: "reset" }
];

function homeAssistant(text?: string): ChatMessage {
  return msg(
    "assistant",
    text ??
      "你好，我是小岛 AI 助手。\n已接入你在「我的」里配置的真实模型。可以自由提问，或点下方快捷项生成计划 / 调整习惯。",
    { quickReplies: HOME_REPLIES }
  );
}

export function createInitialChatState(): ChatEngineState {
  return {
    messages: [homeAssistant()],
    flow: { kind: "idle" }
  };
}

const LEVEL_REPLIES: QuickReply[] = [
  { id: "lv_beginner", label: "新手", value: "beginner" },
  { id: "lv_some", label: "有基础", value: "some_experience" },
  { id: "lv_stable", label: "稳定做过", value: "stable" }
];

const DURATION_REPLIES: QuickReply[] = [
  { id: "d7", label: "7 天", value: "7" },
  { id: "d21", label: "21 天", value: "21" }
];

const MINUTES_REPLIES: QuickReply[] = [
  { id: "m5", label: "5 分钟", value: "5" },
  { id: "m10", label: "10 分钟", value: "10" },
  { id: "m20", label: "20 分钟", value: "20" },
  { id: "m30", label: "30 分钟", value: "30" }
];

const FREQ_REPLIES: QuickReply[] = [
  { id: "f_daily", label: "每天", value: "daily" },
  { id: "f_weekdays", label: "工作日", value: "weekdays" },
  { id: "f_weekly", label: "每周 3 次", value: "weekly" }
];

const REMINDER_REPLIES: QuickReply[] = [
  { id: "r_morning", label: "早上", value: "morning" },
  { id: "r_noon", label: "中午", value: "noon" },
  { id: "r_evening", label: "晚上", value: "evening" }
];

const TRACK_REPLIES: QuickReply[] = [
  { id: "t_check", label: "一键完成", value: "check" },
  { id: "t_numeric", label: "数值记录", value: "numeric" }
];

function askStep(
  state: ChatEngineState,
  step: PlanStep,
  draft: PlanDraft,
  text: string,
  quickReplies?: QuickReply[]
): ChatEngineResult {
  return {
    state: append(withFlow(state, { kind: "plan", step, draft }), msg("assistant", text, { quickReplies })),
    effects: []
  };
}

function startPlan(state: ChatEngineState, goalText?: string): ChatEngineResult {
  const draft: PlanDraft = goalText ? { goalText: goalText.trim() } : {};
  if (draft.goalText) {
    const next = append(state, msg("user", draft.goalText));
    return askStep(next, "level", draft, "收到目标。你目前的基础怎么样？", LEVEL_REPLIES);
  }
  return askStep(state, "goal", draft, "想培养什么习惯？用一句话描述就行，例如「每天运动」。");
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

function continuePlanFromDraft(
  state: ChatEngineState,
  draft: PlanDraft,
  justFilled: PlanStep
): ChatEngineResult {
  if (!draft.goalText) {
    return askStep(state, "goal", draft, "先告诉我你想培养的习惯目标吧。");
  }
  if (!draft.currentLevel) {
    return askStep(state, "level", draft, "你目前的基础怎么样？", LEVEL_REPLIES);
  }
  if (!draft.durationDays) {
    return askStep(state, "duration", draft, "计划做几天？", DURATION_REPLIES);
  }
  if (!draft.dailyAvailableMinutes) {
    return askStep(state, "minutes", draft, "每天大概能投入多少分钟？", MINUTES_REPLIES);
  }
  if (!draft.frequencyType) {
    return askStep(state, "frequency", draft, "希望什么频率？", FREQ_REPLIES);
  }
  if (!draft.reminderPreference) {
    return askStep(state, "reminder", draft, "更习惯什么时段提醒？", REMINDER_REPLIES);
  }
  if (!draft.preferredTrackType) {
    return askStep(state, "track", draft, "打卡时更想怎么记录？", TRACK_REPLIES);
  }

  const required = toRequiredPlanDraft(draft);
  if (!required) {
    return {
      state: append(state, msg("assistant", "参数还不完整，我们重新来一遍。", { quickReplies: HOME_REPLIES })),
      effects: []
    };
  }

  void justFilled;
  return {
    state: append(
      withFlow(state, { kind: "plan", step: "generating", draft }),
      msg("assistant", "正在为你生成分阶段计划，稍等…")
    ),
    effects: [{ type: "generate_plan", draft: required }]
  };
}

function parseMinutes(text: string): number | null {
  const match = text.match(/(\d{1,3})/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n < 1 || n > 180) return null;
  return n;
}

function handlePlanInput(
  state: ChatEngineState,
  draft: PlanDraft,
  step: PlanStep,
  raw: string,
  displayText?: string
): ChatEngineResult {
  const text = raw.trim();
  if (!text) {
    return { state, effects: [] };
  }

  const nextState = append(state, msg("user", (displayText ?? text).trim()));

  if (step === "goal" || (!draft.goalText && step !== "generating")) {
    return continuePlanFromDraft(nextState, { ...draft, goalText: text }, "goal");
  }
  if (step === "level") {
    const map: Record<string, CurrentLevel> = {
      beginner: "beginner",
      some_experience: "some_experience",
      stable: "stable",
      新手: "beginner",
      有基础: "some_experience",
      稳定做过: "stable"
    };
    const level = map[text] ?? map[text.toLowerCase()];
    if (!level) {
      return askStep(nextState, "level", draft, "请点选基础程度，或回复：新手 / 有基础 / 稳定做过。", LEVEL_REPLIES);
    }
    return continuePlanFromDraft(nextState, { ...draft, currentLevel: level }, "level");
  }
  if (step === "duration") {
    const days = text.includes("21") ? 21 : text.includes("7") ? 7 : null;
    if (!days) {
      return askStep(nextState, "duration", draft, "请选择 7 天或 21 天。", DURATION_REPLIES);
    }
    return continuePlanFromDraft(nextState, { ...draft, durationDays: days }, "duration");
  }
  if (step === "minutes") {
    const minutes = parseMinutes(text);
    if (minutes == null) {
      return askStep(nextState, "minutes", draft, "请输入 1–180 的分钟数，或点选下方选项。", MINUTES_REPLIES);
    }
    return continuePlanFromDraft(nextState, { ...draft, dailyAvailableMinutes: minutes }, "minutes");
  }
  if (step === "frequency") {
    let frequencyType: FrequencyType | null = null;
    let weeklyDays = draft.weeklyDays ?? [1, 3, 5];
    if (text === "daily" || text.includes("每天")) frequencyType = "daily";
    else if (text === "weekdays" || text.includes("工作日")) frequencyType = "weekdays";
    else if (text === "weekly" || text.includes("每周")) {
      frequencyType = "weekly";
      weeklyDays = [1, 3, 5];
    }
    if (!frequencyType) {
      return askStep(nextState, "frequency", draft, "请选择频率。", FREQ_REPLIES);
    }
    return continuePlanFromDraft(
      nextState,
      { ...draft, frequencyType, weeklyDays },
      "frequency"
    );
  }
  if (step === "reminder") {
    const map: Record<string, ReminderPreference> = {
      morning: "morning",
      noon: "noon",
      evening: "evening",
      早上: "morning",
      中午: "noon",
      晚上: "evening"
    };
    const preference = map[text] ?? map[text.toLowerCase()];
    if (!preference) {
      return askStep(nextState, "reminder", draft, "请选择提醒时段。", REMINDER_REPLIES);
    }
    return continuePlanFromDraft(
      nextState,
      { ...draft, reminderPreference: preference, customReminderTime: undefined },
      "reminder"
    );
  }
  if (step === "track") {
    let track: HabitTrackType | null = null;
    if (text === "check" || text.includes("一键") || text.includes("完成")) track = "check";
    if (text === "numeric" || text.includes("数值") || text.includes("记录")) track = "numeric";
    if (!track) {
      return askStep(nextState, "track", draft, "请选择记录方式。", TRACK_REPLIES);
    }
    return continuePlanFromDraft(nextState, { ...draft, preferredTrackType: track }, "track");
  }

  return {
    state: append(nextState, msg("assistant", "正在生成中，请稍候…")),
    effects: []
  };
}

function handleIdleText(state: ChatEngineState, text: string): ChatEngineResult {
  const trimmed = text.trim();
  const next = append(state, msg("user", trimmed));

  if (!trimmed) return { state, effects: [] };

  // 明确快捷意图仍走本地引导流；其余交给真实模型自由对话
  if (/^(生成习惯计划|生成计划)$/.test(trimmed)) {
    return startPlan(next);
  }
  if (/^(调整现有习惯|调整计划|调整建议)$/.test(trimmed)) {
    return startAdjust(next);
  }
  if (/^(重新开始|重置)$/.test(trimmed)) {
    return reduceChat(next, { type: "reset" });
  }

  return {
    state: next,
    effects: [{ type: "llm_chat" }]
  };
}

function onHabitsLoaded(state: ChatEngineState, habits: HabitOption[]): ChatEngineResult {
  if (habits.length === 0) {
    return {
      state: append(
        withFlow(state, { kind: "idle" }),
        msg("assistant", "岛上还没有习惯。要不要先生成一个计划？", {
          quickReplies: [
            { id: "plan", label: "生成习惯计划", value: "plan" },
            { id: "reset", label: "返回", value: "reset" }
          ]
        })
      ),
      effects: []
    };
  }

  const replies: QuickReply[] = habits.map((h) => ({
    id: `habit_${h.id}`,
    label: h.name,
    value: h.id
  }));

  return {
    state: append(
      withFlow(state, { kind: "adjust", step: "pick_habit" }),
      msg("assistant", "想调整哪一个？点选即可。", { quickReplies: replies })
    ),
    effects: []
  };
}

function onStatsLoaded(state: ChatEngineState, stats: HabitStatsSnapshot): ChatEngineResult {
  const suggestion = getAdjustmentSuggestion({
    completionRate7Days: stats.completionRate7Days,
    currentStreak: stats.currentStreak,
    planEnded: stats.planEnded,
    manualRequested: true
  });

  if (!suggestion) {
    return {
      state: append(
        withFlow(state, { kind: "idle" }),
        msg(
          "assistant",
          `「${stats.habitName}」最近完成率 ${stats.completionRate7Days}% · 连续 ${stats.currentStreak} 天，节奏看起来不错，先保持就好。`,
          { quickReplies: HOME_REPLIES }
        )
      ),
      effects: []
    };
  }

  return {
    state: append(
      withFlow(state, { kind: "adjust", step: "ready", habitId: stats.habitId }),
      msg(
        "assistant",
        `关于「${stats.habitName}」：近 7 个应执行日完成率 ${stats.completionRate7Days}% · 连续 ${stats.currentStreak} 天。`,
        {
          suggestionCard: {
            habitId: stats.habitId,
            habitName: stats.habitName,
            title: suggestion.title,
            body: suggestion.body,
            actionLabel: suggestion.actionLabel
          },
          quickReplies: [
            {
              id: "apply_suggestion",
              label: suggestion.actionLabel,
              value: `${stats.habitId}|${suggestion.actionLabel}`
            },
            { id: "reset", label: "先不用", value: "reset" }
          ]
        }
      )
    ),
    effects: []
  };
}

export function reduceChat(
  state: ChatEngineState,
  input: ChatEngineInput
): ChatEngineResult {
  if (input.type === "boot") {
    return { state: createInitialChatState(), effects: [] };
  }

  if (input.type === "reset") {
    return {
      state: {
        messages: [...state.messages, homeAssistant("好，已回到起点。还需要什么？")],
        flow: { kind: "idle" }
      },
      effects: []
    };
  }

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

  if (input.type === "habits_loaded") {
    return onHabitsLoaded(state, input.habits);
  }

  if (input.type === "stats_loaded") {
    return onStatsLoaded(state, input.stats);
  }

  if (input.type === "suggestion_applied") {
    return {
      state: append(
        withFlow(state, { kind: "idle" }),
        msg("assistant", input.message, { quickReplies: HOME_REPLIES })
      ),
      effects: []
    };
  }

  if (input.type === "llm_replied") {
    return {
      state: append(
        withFlow(state, { kind: "idle" }),
        msg("assistant", input.text, { quickReplies: HOME_REPLIES })
      ),
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

  if (input.type === "reply") {
    const value = input.value;
    if (value === "reset" || input.replyId === "reset") {
      return reduceChat(state, { type: "reset" });
    }
    if (value === "plan" || input.replyId === "plan") {
      const next = append(state, msg("user", "生成习惯计划"));
      return startPlan(next);
    }
    if (value === "adjust" || input.replyId === "adjust") {
      const next = append(state, msg("user", "调整现有习惯"));
      return startAdjust(next);
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
    // 调整流程选习惯
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
    // 计划流程：chip 用 value 解析，用户气泡展示 label
    if (state.flow.kind === "plan") {
      const display = input.label ?? value;
      const withUser = append(state, msg("user", display));
      // handlePlanInput 会再 append user，所以改成直接改 draft 的内部路径
      return handlePlanInput(state, state.flow.draft, state.flow.step, value, display);
    }
    return handleIdleText(state, input.label ?? value);
  }

  if (input.type === "text") {
    if (state.flow.kind === "plan" && state.flow.step !== "generating") {
      return handlePlanInput(state, state.flow.draft, state.flow.step, input.text);
    }
    if (state.flow.kind === "adjust") {
      return handleIdleText(append(state, msg("user", input.text)), "重新开始");
    }
    return handleIdleText(state, input.text);
  }

  return { state, effects: [] };
}

/** 供 UI 组装生成请求 */
export function draftToRequest(draft: RequiredPlanDraft) {
  return {
    goalText: draft.goalText,
    currentLevel: draft.currentLevel,
    durationDays: draft.durationDays,
    dailyAvailableMinutes: draft.dailyAvailableMinutes,
    expectedFrequency:
      draft.frequencyType === "weekly"
        ? { type: "weekly" as const, daysOfWeek: draft.weeklyDays }
        : draft.frequencyType === "weekdays"
          ? { type: "weekdays" as const }
          : { type: "daily" as const },
    reminderPreference: draft.reminderPreference,
    customReminderTime: draft.customReminderTime,
    preferredTrackType: draft.preferredTrackType
  };
}
