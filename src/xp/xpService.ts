import { getPlanForHabit } from "../ai/habitPlanRepository";
import { listCheckInsForHabit } from "../checkins/checkinRepository";
import { getHabitById } from "../habits/habitRepository";
import { shouldRunOnDate } from "../habits/habitRules";
import { eachDateKey } from "../utils/date";
import { XpAwardResult } from "./types";
import { applyXpTransactions, getWallet } from "./xpRepository";
import { calculateCheckInXpAwards } from "./xpRules";

export async function awardXpForCheckIn(input: {
  habitId: string;
  dateKey: string;
  checkInId?: string | null;
}): Promise<XpAwardResult> {
  const habit = await getHabitById(input.habitId);

  if (!habit) {
    throw new Error("习惯不存在，无法发放 XP");
  }

  const checkIns = await listCheckInsForHabit(input.habitId);
  const completedDates = checkIns
    .filter((checkIn) => checkIn.status === "completed")
    .map((checkIn) => checkIn.date);
  const createdKey = habit.createdAt.slice(0, 10);
  const habitStart = completedDates.reduce(
    (earliest, date) => (date < earliest ? date : earliest),
    createdKey
  );
  const scheduledDates = eachDateKey(habitStart, input.dateKey).filter((date) =>
    shouldRunOnDate(habit.frequency, new Date(`${date}T00:00:00`))
  );
  const plan = await getPlanForHabit(input.habitId);
  const planCompleted = Boolean(plan && input.dateKey >= plan.endDate);
  const hasAnyEarlierCompletion = completedDates.some((date) => date < input.dateKey);
  const awards = calculateCheckInXpAwards({
    habitId: input.habitId,
    dateKey: input.dateKey,
    scheduledDates,
    completedDates,
    hasAnyEarlierCompletion,
    planCompleted
  });

  const insertedTransactions = await applyXpTransactions(
    awards.map((award) => ({
      uniqueKey:
        award.reason === "plan_complete" && plan ? `plan_complete:${plan.id}` : award.uniqueKey,
      amount: award.amount,
      type: "earn",
      reason: award.reason,
      habitId: input.habitId,
      checkInId: input.checkInId ?? null,
      rewardId: null,
      redemptionId: null,
      dateKey: input.dateKey
    }))
  );

  return {
    awards,
    insertedTransactions,
    wallet: await getWallet()
  };
}
