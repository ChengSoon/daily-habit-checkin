export type AdjustmentSuggestion = {
  title: string;
  body: string;
  actionLabel: string;
};

export function getAdjustmentSuggestion(input: {
  completionRate7Days: number;
  currentStreak: number;
  planEnded: boolean;
  manualRequested?: boolean;
}): AdjustmentSuggestion | null {
  if (input.completionRate7Days < 40) {
    return {
      title: "把目标调轻一点",
      body: "最近完成率偏低，可以先缩短任务或换一个更容易开始的提醒时间。",
      actionLabel: "调整计划"
    };
  }

  if (input.currentStreak >= 7) {
    return {
      title: "节奏很好，先保持",
      body: "你已经连续完成 7 天，不急着加难度，稳定比冲刺更重要。",
      actionLabel: "继续保持"
    };
  }

  if (input.planEnded) {
    return {
      title: "计划结束了",
      body: "可以基于这段时间的完成情况，生成下一阶段计划。",
      actionLabel: "生成下一阶段"
    };
  }

  // 用户主动点「调整计划」时，即使未触发自动条件，也给一条温和的调整建议。
  if (input.manualRequested) {
    return {
      title: "想调整一下节奏？",
      body: "可以缩短单次任务、换个更合适的提醒时间，或先保持当前节奏。",
      actionLabel: "调整计划"
    };
  }

  return null;
}
