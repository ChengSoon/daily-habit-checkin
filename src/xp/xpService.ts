import { getPlanForHabit } from "../ai/habitPlanRepository";
import { listCheckInsForHabit } from "../checkins/checkinRepository";
import { getHabitById } from "../habits/habitRepository";
import { shouldRunOnDate } from "../habits/habitRules";
import { eachDateKey } from "../utils/date";
import { XpAward, XpAwardResult, XpRevokeResult, XpTransaction } from "./types";
import { applyXpTransactions, getWallet, listXpTransactions } from "./xpRepository";
import { calculateCheckInXpAwards } from "./xpRules";

const CHECKIN_AWARD_REASONS: XpAward["reason"][] = [
  "checkin",
  "streak_3",
  "streak_7",
  "plan_complete",
  "return_bonus"
];

function canonicalAwardKey(award: XpAward, planId: string | null): string {
  return award.reason === "plan_complete" && planId ? `plan_complete:${planId}` : award.uniqueKey;
}

function shouldRedoAward(uniqueKey: string, transactions: XpTransaction[]): boolean {
  const hasOriginal = transactions.some((transaction) => transaction.uniqueKey === uniqueKey);
  const hasUndo = transactions.some((transaction) => transaction.uniqueKey.startsWith(`checkin_undo:${uniqueKey}:`));
  return hasOriginal && hasUndo;
}

function matchesUndoTarget(
  transaction: XpTransaction,
  input: {
    habitId: string;
    dateKey: string;
    checkInId?: string | null;
  }
): boolean {
  const sameHabitDate = transaction.habitId === input.habitId && transaction.dateKey === input.dateKey;
  if (!sameHabitDate || !CHECKIN_AWARD_REASONS.includes(transaction.reason as XpAward["reason"])) {
    return false;
  }
  return !input.checkInId || transaction.checkInId === input.checkInId || transaction.checkInId === null;
}

async function getCheckInAwardContext(input: {
  habitId: string;
  dateKey: string;
}): Promise<{ awards: XpAward[]; planId: string | null }> {
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

  return {
    awards,
    planId: plan?.id ?? null
  };
}

export async function awardXpForCheckIn(input: {
  habitId: string;
  dateKey: string;
  checkInId?: string | null;
}): Promise<XpAwardResult> {
  const { awards, planId } = await getCheckInAwardContext(input);

  const existingTransactions = await listXpTransactions();
  const insertedTransactions = await applyXpTransactions(
    awards.map((award) => {
      const uniqueKey = canonicalAwardKey(award, planId);
      return {
        uniqueKey: shouldRedoAward(uniqueKey, existingTransactions)
          ? `checkin_redo:${uniqueKey}:${input.checkInId ?? "unknown"}`
          : uniqueKey,
        amount: award.amount,
        type: "earn",
        reason: award.reason,
        habitId: input.habitId,
        checkInId: input.checkInId ?? null,
        rewardId: null,
        redemptionId: null,
        dateKey: input.dateKey
      };
    })
  );

  return {
    awards,
    insertedTransactions,
    wallet: await getWallet()
  };
}

export async function revokeXpForCheckIn(input: {
  habitId: string;
  dateKey: string;
  checkInId?: string | null;
}): Promise<XpRevokeResult> {
  const transactions = await listXpTransactions();
  const targets = transactions.filter((transaction) =>
    transaction.amount > 0 && matchesUndoTarget(transaction, input)
  );

  const insertedTransactions = await applyXpTransactions(
    targets.map((transaction) => ({
      uniqueKey: `checkin_undo:${transaction.uniqueKey}:${input.checkInId ?? "unknown"}`,
      amount: -transaction.amount,
      type: "adjust",
      reason: "checkin_undo",
      habitId: input.habitId,
      checkInId: input.checkInId ?? null,
      rewardId: null,
      redemptionId: null,
      dateKey: input.dateKey
    }))
  );

  return {
    reversedAmount: insertedTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    insertedTransactions,
    wallet: await getWallet()
  };
}
