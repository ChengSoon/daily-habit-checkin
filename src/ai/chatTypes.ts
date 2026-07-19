import { HabitFrequency, HabitTrackType } from "../habits/types";
import { AIPlanPreview } from "./types";

export type CurrentLevel = "beginner" | "some_experience" | "stable";
export type ReminderPreference = "morning" | "noon" | "evening" | "custom";
export type FrequencyType = "daily" | "weekdays" | "weekly";

export type QuickReply = {
  id: string;
  label: string;
  /** 提交给引擎的值；缺省用 label */
  value?: string;
};

export type PlanCardPayload = {
  plan: AIPlanPreview;
  goalText: string;
  frequencyType: FrequencyType;
  weeklyDays: number[];
};

export type SuggestionCardPayload = {
  habitId: string;
  habitName: string;
  title: string;
  body: string;
  actionLabel: string;
};

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  createdAt: number;
  quickReplies?: QuickReply[];
  planCard?: PlanCardPayload;
  suggestionCard?: SuggestionCardPayload;
};

export type PlanDraft = {
  goalText?: string;
  currentLevel?: CurrentLevel;
  durationDays?: 7 | 21;
  dailyAvailableMinutes?: number;
  frequencyType?: FrequencyType;
  weeklyDays?: number[];
  reminderPreference?: ReminderPreference;
  customReminderTime?: string | null;
  preferredTrackType?: HabitTrackType;
};

export type PlanStep =
  | "goal"
  | "level"
  | "duration"
  | "minutes"
  | "frequency"
  | "reminder"
  | "track"
  | "generating";

export type AdjustStep = "pick_habit" | "ready";

export type ChatFlow =
  | { kind: "idle" }
  | { kind: "plan"; step: PlanStep; draft: PlanDraft }
  | { kind: "adjust"; step: AdjustStep; habitId?: string };

export type HabitOption = {
  id: string;
  name: string;
};

export type HabitStatsSnapshot = {
  habitId: string;
  habitName: string;
  completionRate7Days: number;
  currentStreak: number;
  planEnded: boolean;
};

export type ChatEngineInput =
  | { type: "boot" }
  | { type: "text"; text: string }
  | { type: "reply"; replyId: string; value: string; label?: string }
  | { type: "plan_generated"; plan: AIPlanPreview; draft: PlanDraft }
  | { type: "plan_failed"; error: string }
  | { type: "habits_loaded"; habits: HabitOption[] }
  | { type: "stats_loaded"; stats: HabitStatsSnapshot }
  | { type: "suggestion_applied"; message: string }
  | { type: "llm_replied"; text: string }
  | { type: "llm_failed"; error: string }
  | { type: "reset" };

export type ChatEngineEffect =
  | { type: "generate_plan"; draft: RequiredPlanDraft }
  | { type: "llm_chat" }
  | { type: "load_habits" }
  | { type: "load_habit_stats"; habitId: string }
  | { type: "apply_suggestion"; habitId: string; actionLabel: string };

/** 生成计划所需的完整草稿（引擎保证齐备后才发 effect） */
export type RequiredPlanDraft = {
  goalText: string;
  currentLevel: CurrentLevel;
  durationDays: 7 | 21;
  dailyAvailableMinutes: number;
  frequencyType: FrequencyType;
  weeklyDays: number[];
  reminderPreference: ReminderPreference;
  customReminderTime: string | null;
  preferredTrackType: HabitTrackType;
};

export function toFrequency(type: FrequencyType, weeklyDays: number[]): HabitFrequency {
  if (type === "weekdays") {
    return { type: "weekdays" };
  }
  if (type === "weekly") {
    return { type: "weekly", daysOfWeek: [...weeklyDays].sort((a, b) => a - b) };
  }
  return { type: "daily" };
}

export function isPlanDraftReady(draft: PlanDraft): draft is PlanDraft & {
  goalText: string;
  currentLevel: CurrentLevel;
  durationDays: 7 | 21;
  dailyAvailableMinutes: number;
  frequencyType: FrequencyType;
  preferredTrackType: HabitTrackType;
  reminderPreference: ReminderPreference;
} {
  return Boolean(
    draft.goalText &&
      draft.currentLevel &&
      draft.durationDays &&
      draft.dailyAvailableMinutes &&
      draft.frequencyType &&
      draft.preferredTrackType &&
      draft.reminderPreference
  );
}

export function toRequiredPlanDraft(draft: PlanDraft): RequiredPlanDraft | null {
  if (!isPlanDraftReady(draft)) {
    return null;
  }
  const weeklyDays = draft.weeklyDays ?? [1, 3, 5];
  if (draft.frequencyType === "weekly" && weeklyDays.length === 0) {
    return null;
  }
  return {
    goalText: draft.goalText,
    currentLevel: draft.currentLevel,
    durationDays: draft.durationDays,
    dailyAvailableMinutes: draft.dailyAvailableMinutes,
    frequencyType: draft.frequencyType,
    weeklyDays,
    reminderPreference: draft.reminderPreference,
    customReminderTime:
      draft.reminderPreference === "custom" ? draft.customReminderTime ?? "21:30" : null,
    preferredTrackType: draft.preferredTrackType
  };
}
