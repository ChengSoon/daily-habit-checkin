import { XpAward } from "./types";

type CheckInXpInput = {
  habitId: string;
  dateKey: string;
  scheduledDates: string[];
  completedDates: string[];
  planCompleted: boolean;
};

const AWARD_LABELS = {
  checkin: "完成打卡",
  streak_3: "连续 3 天",
  streak_7: "连续 7 天",
  plan_complete: "完成阶段计划"
} as const;

function currentStreak(dateKey: string, scheduledDates: string[], completedDates: Set<string>): number {
  const scheduled = scheduledDates.filter((date) => date <= dateKey).sort();
  let streak = 0;

  for (let index = scheduled.length - 1; index >= 0; index -= 1) {
    const date = scheduled[index];

    if (!completedDates.has(date)) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function award(input: { habitId: string; dateKey: string; reason: XpAward["reason"]; amount: number }): XpAward {
  return {
    reason: input.reason,
    amount: input.amount,
    label: AWARD_LABELS[input.reason],
    uniqueKey: `${input.reason}:${input.habitId}:${input.dateKey}`
  };
}

export function calculateCheckInXpAwards(input: CheckInXpInput): XpAward[] {
  const completedDates = new Set(input.completedDates);
  const awards: XpAward[] = [award({ ...input, reason: "checkin", amount: 10 })];
  const streak = currentStreak(input.dateKey, input.scheduledDates, completedDates);

  if (streak === 3) {
    awards.push(award({ ...input, reason: "streak_3", amount: 20 }));
  }

  if (streak === 7) {
    awards.push(award({ ...input, reason: "streak_7", amount: 50 }));
  }

  if (input.planCompleted) {
    awards.push(award({ ...input, reason: "plan_complete", amount: 100 }));
  }

  return awards;
}
