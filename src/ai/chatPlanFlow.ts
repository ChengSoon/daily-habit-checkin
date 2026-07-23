import { HabitTrackType } from "../habits/types";
import { append, HOME_REPLIES, msg, withFlow, type ChatEngineResult, type ChatEngineState } from "./chatEngineShared";
import {
  CurrentLevel,
  FrequencyType,
  PlanDraft,
  PlanStep,
  QuickReply,
  ReminderPreference,
  toRequiredPlanDraft
} from "./chatTypes";

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
  draft: PlanDraft,
  prompt: { step: PlanStep; text: string; quickReplies?: QuickReply[] }
): ChatEngineResult {
  return {
    state: append(
      withFlow(state, { kind: "plan", step: prompt.step, draft }),
      msg("assistant", prompt.text, { quickReplies: prompt.quickReplies })
    ),
    effects: []
  };
}

export function startPlan(state: ChatEngineState, goalText?: string): ChatEngineResult {
  const draft: PlanDraft = goalText ? { goalText: goalText.trim() } : {};
  if (draft.goalText) {
    return askStep(append(state, msg("user", draft.goalText)), draft, {
      step: "level", text: "收到目标。你目前的基础怎么样？", quickReplies: LEVEL_REPLIES
    });
  }
  return askStep(state, draft, { step: "goal", text: "想培养什么习惯？用一句话描述就行，例如「每天运动」。" });
}

function continuePlanFromDraft(
  state: ChatEngineState,
  draft: PlanDraft
): ChatEngineResult {
  if (!draft.goalText) return askStep(state, draft, { step: "goal", text: "先告诉我你想培养的习惯目标吧。" });
  if (!draft.currentLevel) {
    return askStep(state, draft, { step: "level", text: "你目前的基础怎么样？", quickReplies: LEVEL_REPLIES });
  }
  if (!draft.durationDays) {
    return askStep(state, draft, { step: "duration", text: "计划做几天？", quickReplies: DURATION_REPLIES });
  }
  if (!draft.dailyAvailableMinutes) {
    return askStep(state, draft, { step: "minutes", text: "每天大概能投入多少分钟？", quickReplies: MINUTES_REPLIES });
  }
  if (!draft.frequencyType) {
    return askStep(state, draft, { step: "frequency", text: "希望什么频率？", quickReplies: FREQ_REPLIES });
  }
  if (!draft.reminderPreference) {
    return askStep(state, draft, { step: "reminder", text: "更习惯什么时段提醒？", quickReplies: REMINDER_REPLIES });
  }
  if (!draft.preferredTrackType) {
    return askStep(state, draft, { step: "track", text: "打卡时更想怎么记录？", quickReplies: TRACK_REPLIES });
  }
  const required = toRequiredPlanDraft(draft);
  if (!required) {
    return {
      state: append(state, msg("assistant", "参数还不完整，我们重新来一遍。", { quickReplies: HOME_REPLIES })),
      effects: []
    };
  }
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
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) && minutes >= 1 && minutes <= 180 ? minutes : null;
}

type PlanInputContext = {
  draft: PlanDraft;
  nextState: ChatEngineState;
  text: string;
};

function handleLevel({ draft, nextState, text }: PlanInputContext): ChatEngineResult {
  const levels: Record<string, CurrentLevel> = {
    beginner: "beginner", some_experience: "some_experience", stable: "stable",
    新手: "beginner", 有基础: "some_experience", 稳定做过: "stable"
  };
  const level = levels[text] ?? levels[text.toLowerCase()];
  return level
    ? continuePlanFromDraft(nextState, { ...draft, currentLevel: level })
    : askStep(nextState, draft, {
      step: "level", text: "请点选基础程度，或回复：新手 / 有基础 / 稳定做过。", quickReplies: LEVEL_REPLIES
    });
}

function handleFrequency({ draft, nextState, text }: PlanInputContext): ChatEngineResult {
  let frequencyType: FrequencyType | null = null;
  let weeklyDays = draft.weeklyDays ?? [1, 3, 5];
  if (text === "daily" || text.includes("每天")) frequencyType = "daily";
  else if (text === "weekdays" || text.includes("工作日")) frequencyType = "weekdays";
  else if (text === "weekly" || text.includes("每周")) {
    frequencyType = "weekly";
    weeklyDays = [1, 3, 5];
  }
  return frequencyType
    ? continuePlanFromDraft(nextState, { ...draft, frequencyType, weeklyDays })
    : askStep(nextState, draft, { step: "frequency", text: "请选择频率。", quickReplies: FREQ_REPLIES });
}

function handleReminder({ draft, nextState, text }: PlanInputContext): ChatEngineResult {
  const reminders: Record<string, ReminderPreference> = {
    morning: "morning", noon: "noon", evening: "evening",
    早上: "morning", 中午: "noon", 晚上: "evening"
  };
  const reminder = reminders[text] ?? reminders[text.toLowerCase()];
  return reminder
    ? continuePlanFromDraft(nextState, { ...draft, reminderPreference: reminder, customReminderTime: undefined })
    : askStep(nextState, draft, { step: "reminder", text: "请选择提醒时段。", quickReplies: REMINDER_REPLIES });
}

function handleTrack({ draft, nextState, text }: PlanInputContext): ChatEngineResult {
  let track: HabitTrackType | null = null;
  if (text === "check" || text.includes("一键") || text.includes("完成")) track = "check";
  if (text === "numeric" || text.includes("数值") || text.includes("记录")) track = "numeric";
  return track
    ? continuePlanFromDraft(nextState, { ...draft, preferredTrackType: track })
    : askStep(nextState, draft, { step: "track", text: "请选择记录方式。", quickReplies: TRACK_REPLIES });
}

function handleSimpleStep(step: PlanStep, context: PlanInputContext): ChatEngineResult | null {
  const { draft, nextState, text } = context;
  if (step === "level") return handleLevel(context);
  if (step === "duration") {
    const days = text.includes("21") ? 21 : text.includes("7") ? 7 : null;
    return days
      ? continuePlanFromDraft(nextState, { ...draft, durationDays: days })
      : askStep(nextState, draft, { step: "duration", text: "请选择 7 天或 21 天。", quickReplies: DURATION_REPLIES });
  }
  if (step === "minutes") {
    const minutes = parseMinutes(text);
    return minutes === null
      ? askStep(nextState, draft, {
        step: "minutes", text: "请输入 1–180 的分钟数，或点选下方选项。", quickReplies: MINUTES_REPLIES
      })
      : continuePlanFromDraft(nextState, { ...draft, dailyAvailableMinutes: minutes });
  }
  if (step === "frequency") return handleFrequency(context);
  if (step === "reminder") return handleReminder(context);
  if (step === "track") return handleTrack(context);
  return null;
}

export function handlePlanInput(options: {
  state: ChatEngineState;
  draft: PlanDraft;
  step: PlanStep;
  raw: string;
  displayText?: string;
}): ChatEngineResult {
  const { state, draft, step, raw, displayText } = options;
  const text = raw.trim();
  if (!text) return { state, effects: [] };
  const nextState = append(state, msg("user", (displayText ?? text).trim()));
  if (step === "goal" || (!draft.goalText && step !== "generating")) {
    return continuePlanFromDraft(nextState, { ...draft, goalText: text });
  }
  const result = handleSimpleStep(step, { draft, nextState, text });
  if (result) return result;
  return { state: append(nextState, msg("assistant", "正在生成中，请稍候…")), effects: [] };
}
