import { CheckIn } from "./types";

type StreakInput = {
  today: string;
  scheduledDates: string[];
  checkIns: CheckIn[];
};

type CompletionRateInput = {
  scheduledDates: string[];
  checkIns: CheckIn[];
};

export function calculateCurrentStreak({ today, scheduledDates, checkIns }: StreakInput): number {
  const scheduled = scheduledDates.filter((date) => date <= today).sort();
  const completedDates = new Set(
    checkIns.filter((checkIn) => checkIn.status === "completed").map((checkIn) => checkIn.date)
  );

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

export function calculateMonthlyCompletionRate({ scheduledDates, checkIns }: CompletionRateInput): number {
  if (scheduledDates.length === 0) {
    return 0;
  }

  const completedDates = new Set(
    checkIns.filter((checkIn) => checkIn.status === "completed").map((checkIn) => checkIn.date)
  );
  const completedCount = scheduledDates.filter((date) => completedDates.has(date)).length;

  return Math.round((completedCount / scheduledDates.length) * 100);
}
