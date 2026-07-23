export type HabitRow = {
  id: string;
  name: string;
  frequency_json: string;
  created_at: string | Date;
  is_paused: boolean;
  track_type: string;
};

export type CheckInRow = {
  id: string;
  habit_id: string;
  date: string;
  status: string;
  value: number | null;
  note: string | null;
  created_by: string | null;
  created_at: string | Date;
};

export type TransactionRow = {
  id: string;
  unique_key: string;
  amount: number;
  type: string;
  reason: string;
  habit_id: string | null;
  check_in_id: string | null;
  reward_id: string | null;
  redemption_id: string | null;
  date_key: string | null;
  created_at: string | Date;
};

export type WalletRow = {
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  updated_at: string | Date;
};

type Frequency =
  | { type: "daily" }
  | { type: "weekdays" }
  | { type: "weekly"; daysOfWeek: number[] };

export const AWARD_LABELS: Record<string, string> = {
  checkin: "完成打卡",
  streak_3: "连续 3 天",
  streak_7: "连续 7 天",
  plan_complete: "完成阶段计划"
};

export function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function parseFrequency(raw: string): Frequency {
  const parsed = JSON.parse(raw) as Frequency;
  if (parsed.type === "weekly" && !Array.isArray(parsed.daysOfWeek)) throw new Error("习惯频率配置不正确");
  if (!["daily", "weekdays", "weekly"].includes(parsed.type)) throw new Error("习惯频率配置不正确");
  return parsed;
}

function addDay(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function isScheduled(frequency: Frequency, date: string): boolean {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return frequency.type === "daily" ||
    (frequency.type === "weekdays" && day >= 1 && day <= 5) ||
    (frequency.type === "weekly" && frequency.daysOfWeek.includes(day));
}

function scheduledDates(habit: HabitRow, endDate: string): string[] {
  const start = iso(habit.created_at).slice(0, 10);
  const frequency = parseFrequency(habit.frequency_json);
  const dates: string[] = [];
  for (let cursor = start; cursor <= endDate; cursor = addDay(cursor)) {
    if (isScheduled(frequency, cursor)) dates.push(cursor);
  }
  return dates;
}

export function streakFor(habit: HabitRow, date: string, completed: Set<string>): number {
  let streak = 0;
  const scheduled = scheduledDates(habit, date);
  for (let index = scheduled.length - 1; index >= 0 && completed.has(scheduled[index]); index -= 1) {
    streak += 1;
  }
  return streak;
}

export function mapCheckIn(row: CheckInRow) {
  return {
    id: row.id,
    habitId: row.habit_id,
    date: row.date,
    status: row.status,
    value: row.value,
    note: row.note,
    createdBy: row.created_by,
    createdAt: iso(row.created_at)
  };
}

export function mapTransaction(row: TransactionRow) {
  return {
    id: row.id,
    uniqueKey: row.unique_key,
    amount: row.amount,
    type: row.type,
    reason: row.reason,
    habitId: row.habit_id,
    checkInId: row.check_in_id,
    rewardId: row.reward_id,
    redemptionId: row.redemption_id,
    dateKey: row.date_key,
    createdAt: iso(row.created_at)
  };
}

export function mapWallet(row: WalletRow) {
  return {
    balance: Number(row.balance),
    lifetimeEarned: Number(row.lifetime_earned),
    lifetimeSpent: Number(row.lifetime_spent),
    updatedAt: iso(row.updated_at)
  };
}

export function awardDefinitions(options: { habit: HabitRow; date: string; streak: number; planId: string | null }) {
  const { habit, date, streak, planId } = options;
  const awards = [{ uniqueKey: `checkin:${habit.id}:${date}`, amount: 10, reason: "checkin" }];
  if (streak === 3) awards.push({ uniqueKey: `streak_3:${habit.id}:${date}`, amount: 20, reason: "streak_3" });
  if (streak === 7) awards.push({ uniqueKey: `streak_7:${habit.id}:${date}`, amount: 50, reason: "streak_7" });
  if (planId) awards.push({ uniqueKey: `plan_complete:${planId}`, amount: 100, reason: "plan_complete" });
  return awards;
}
