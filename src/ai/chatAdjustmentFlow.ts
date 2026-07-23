import { getAdjustmentSuggestion } from "./adjustmentRules";
import { append, HOME_REPLIES, msg, withFlow, type ChatEngineResult, type ChatEngineState } from "./chatEngineShared";
import { HabitOption, HabitStatsSnapshot, QuickReply } from "./chatTypes";

export function onHabitsLoaded(state: ChatEngineState, habits: HabitOption[]): ChatEngineResult {
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
  const replies: QuickReply[] = habits.map((habit) => ({
    id: `habit_${habit.id}`,
    label: habit.name,
    value: habit.id
  }));
  return {
    state: append(
      withFlow(state, { kind: "adjust", step: "pick_habit" }),
      msg("assistant", "想调整哪一个？点选即可。", { quickReplies: replies })
    ),
    effects: []
  };
}

export function onStatsLoaded(state: ChatEngineState, stats: HabitStatsSnapshot): ChatEngineResult {
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
