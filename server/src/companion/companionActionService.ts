import { randomUUID } from "node:crypto";
import { advanceAdventureProgress } from "../adventure/adventureService.js";
import type { CompanionDb } from "./companionRepository.js";
import type { CompanionActionCommand } from "./companionActionSchemas.js";

type HabitRow = {
  id: string;
  name: string;
  frequency_json: string;
  created_at: string | Date;
  is_paused: boolean;
  track_type: string;
  numeric_unit: string | null;
};

type HabitFrequency =
  | { type: "daily" }
  | { type: "weekdays" }
  | { type: "weekly"; daysOfWeek: number[] };

function dateKey(now: Date, offsetMinutes: number): string {
  return new Date(now.getTime() - offsetMinutes * 60_000).toISOString().slice(0, 10);
}

function parseFrequency(raw: string): HabitFrequency {
  try {
    const parsed = JSON.parse(raw) as HabitFrequency;
    if (parsed.type === "weekdays" || parsed.type === "weekly" || parsed.type === "daily") {
      return parsed;
    }
  } catch {
    // Legacy malformed rows use the safest daily fallback.
  }
  return { type: "daily" };
}

function addDay(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function scheduledDates(habit: HabitRow, endDate: string): string[] {
  const dates: string[] = [];
  const frequency = parseFrequency(habit.frequency_json);
  let cursor = (habit.created_at instanceof Date ? habit.created_at.toISOString() : String(habit.created_at)).slice(0, 10);
  while (cursor <= endDate) {
    const day = new Date(`${cursor}T00:00:00.000Z`).getUTCDay();
    const scheduled =
      frequency.type === "daily" ||
      (frequency.type === "weekdays" && day >= 1 && day <= 5) ||
      (frequency.type === "weekly" && frequency.daysOfWeek.includes(day));
    if (scheduled) dates.push(cursor);
    cursor = addDay(cursor);
  }
  return dates;
}

function currentStreak(scheduled: string[], completed: Set<string>): number {
  let streak = 0;
  for (let index = scheduled.length - 1; index >= 0; index -= 1) {
    if (!completed.has(scheduled[index])) break;
    streak += 1;
  }
  return streak;
}

async function readHabit(client: CompanionDb, spaceId: string, habitId: string): Promise<HabitRow | null> {
  const result = await client.query<HabitRow>(
    `SELECT id, name, frequency_json, created_at, is_paused, track_type, numeric_unit
       FROM habits WHERE id = $1 AND space_id = $2`,
    [habitId, spaceId]
  );
  return result.rows[0] ?? null;
}

async function createHabit(
  client: CompanionDb,
  spaceId: string,
  command: Extract<CompanionActionCommand, { type: "create_habit" }>
): Promise<{ message: string; resources: string[] }> {
  const id = randomUUID();
  const input = command.arguments;
  await client.query(
    `INSERT INTO habits
       (id, space_id, name, description, frequency_json, reminder_time,
        is_reminder_enabled, is_paused, track_type, numeric_unit, sort_order, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9,
             COALESCE((SELECT MAX(sort_order) + 1 FROM habits WHERE space_id = $2), 0), now())`,
    [
      id,
      spaceId,
      input.name,
      input.description,
      JSON.stringify(input.frequency),
      input.reminderTime,
      input.reminderTime !== null,
      input.trackType,
      input.numericUnit
    ]
  );
  return { message: `已经新建「${input.name}」习惯。`, resources: ["habits"] };
}

async function updateHabit(
  client: CompanionDb,
  spaceId: string,
  command: Extract<CompanionActionCommand, { type: "update_habit" }>
): Promise<{ message: string; resources: string[] }> {
  const input = command.arguments;
  const sets: string[] = [];
  const values: unknown[] = [spaceId, input.habitId];
  const add = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };
  if (input.name !== undefined) add("name", input.name);
  if (input.description !== undefined) add("description", input.description);
  if (input.frequency !== undefined) add("frequency_json", JSON.stringify(input.frequency));
  if (input.reminderTime !== undefined) {
    add("reminder_time", input.reminderTime);
    add("is_reminder_enabled", input.reminderTime !== null);
  }
  const result = await client.query<{ name: string }>(
    `UPDATE habits SET ${sets.join(", ")}
       WHERE space_id = $1 AND id = $2 RETURNING name`,
    values
  );
  if (result.rows.length === 0) throw new Error("找不到这个习惯");
  return { message: `已经更新「${result.rows[0].name}」的设置。`, resources: ["habits"] };
}

async function setHabitPaused(
  client: CompanionDb,
  spaceId: string,
  command: Extract<CompanionActionCommand, { type: "set_habit_paused" }>
): Promise<{ message: string; resources: string[] }> {
  const result = await client.query<{ name: string }>(
    `UPDATE habits SET is_paused = $3
       WHERE space_id = $1 AND id = $2 RETURNING name`,
    [spaceId, command.arguments.habitId, command.arguments.paused]
  );
  if (result.rows.length === 0) throw new Error("找不到这个习惯");
  const verb = command.arguments.paused ? "暂停" : "恢复";
  return { message: `已经${verb}「${result.rows[0].name}」习惯。`, resources: ["habits"] };
}

async function ensureWallet(client: CompanionDb, spaceId: string): Promise<void> {
  await client.query(
    `INSERT INTO xp_wallet (space_id, balance, lifetime_earned, lifetime_spent, updated_at)
     VALUES ($1, 0, 0, 0, now()) ON CONFLICT (space_id) DO NOTHING`,
    [spaceId]
  );
}

async function completeCheckIn(
  client: CompanionDb,
  spaceId: string,
  accountId: string,
  command: Extract<CompanionActionCommand, { type: "complete_checkin" }>,
  now: Date,
  offsetMinutes: number
): Promise<{ message: string; resources: string[] }> {
  const habit = await readHabit(client, spaceId, command.arguments.habitId);
  if (!habit) throw new Error("找不到这个习惯");
  if (habit.is_paused) throw new Error("这个习惯已经暂停了");
  const date = dateKey(now, offsetMinutes);
  const frequency = parseFrequency(habit.frequency_json);
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const scheduledToday =
    frequency.type === "daily" ||
    (frequency.type === "weekdays" && day >= 1 && day <= 5) ||
    (frequency.type === "weekly" && frequency.daysOfWeek.includes(day));
  if (!scheduledToday) throw new Error("今天不是这个习惯的计划日");
  if (habit.track_type === "numeric" && command.arguments.value === null) {
    throw new Error("这是数值习惯，还需要一个完成数值");
  }
  if (habit.track_type !== "numeric" && command.arguments.value !== null) {
    throw new Error("这个习惯不需要填写数值");
  }

  const existing = await client.query<{ id: string }>(
    `SELECT id FROM check_ins WHERE space_id = $1 AND habit_id = $2 AND date = $3
       AND status = 'completed'`,
    [spaceId, habit.id, date]
  );
  if (existing.rows.length > 0) {
    return { message: `「${habit.name}」今天已经完成，不需要重复打卡。`, resources: ["check_ins"] };
  }

  const checkInId = randomUUID();
  await client.query(
    `INSERT INTO check_ins
       (id, space_id, habit_id, date, status, value, note, created_by, created_at)
     VALUES ($1, $2, $3, $4, 'completed', $5, NULL, $6, now())`,
    [checkInId, spaceId, habit.id, date, command.arguments.value, accountId]
  );
  const completedRows = await client.query<{ date: string }>(
    `SELECT date FROM check_ins WHERE space_id = $1 AND habit_id = $2 AND status = 'completed'`,
    [spaceId, habit.id]
  );
  const completed = new Set(completedRows.rows.map((row) => row.date));
  const streak = currentStreak(scheduledDates(habit, date), completed);
  const plan = await client.query<{ id: string; end_date: string }>(
    `SELECT id, end_date FROM habit_plans WHERE space_id = $1 AND habit_id = $2
       ORDER BY end_date DESC LIMIT 1`,
    [spaceId, habit.id]
  );
  const awards = [{ key: `checkin:${habit.id}:${date}`, amount: 10, reason: "checkin" }];
  if (streak === 3) awards.push({ key: `streak_3:${habit.id}:${date}`, amount: 20, reason: "streak_3" });
  if (streak === 7) awards.push({ key: `streak_7:${habit.id}:${date}`, amount: 50, reason: "streak_7" });
  if (plan.rows[0] && date >= plan.rows[0].end_date) {
    awards.push({ key: `plan_complete:${plan.rows[0].id}`, amount: 100, reason: "plan_complete" });
  }
  await ensureWallet(client, spaceId);
  for (const award of awards) {
    const inserted = await client.query(
      `INSERT INTO xp_transactions
         (id, space_id, unique_key, amount, type, reason, habit_id, check_in_id, date_key, created_at)
       VALUES ($1, $2, $3, $4, 'earn', $5, $6, $7, $8, now())
       ON CONFLICT (space_id, unique_key) DO NOTHING`,
      [randomUUID(), spaceId, award.key, award.amount, award.reason, habit.id, checkInId, date]
    );
    if (inserted.rowCount) {
      await client.query(
        `UPDATE xp_wallet SET balance = balance + $2,
          lifetime_earned = lifetime_earned + $2, updated_at = now() WHERE space_id = $1`,
        [spaceId, award.amount]
      );
    }
  }
  const suffix = streak >= 3 ? ` 已连续 ${streak} 天。` : "";
  return { message: `已经完成「${habit.name}」今天的打卡，获得 XP。${suffix}`, resources: ["check_ins", "wallet"] };
}

export async function executeCompanionAction(input: {
  client: CompanionDb;
  spaceId: string;
  accountId: string;
  command: CompanionActionCommand;
  now: Date;
  timezoneOffsetMinutes: number;
}): Promise<{ message: string; resources: string[] }> {
  switch (input.command.type) {
    case "complete_checkin":
      return completeCheckIn(input.client, input.spaceId, input.accountId, input.command, input.now, input.timezoneOffsetMinutes);
    case "create_habit":
      return createHabit(input.client, input.spaceId, input.command);
    case "update_habit":
      return updateHabit(input.client, input.spaceId, input.command);
    case "set_habit_paused":
      return setHabitPaused(input.client, input.spaceId, input.command);
  }
}

export async function refreshAdventureAfterAction(spaceId: string, resources: string[]): Promise<string[]> {
  if (!resources.includes("wallet")) return resources;
  try {
    await advanceAdventureProgress(spaceId);
    return [...resources, "adventure"];
  } catch {
    return resources;
  }
}
