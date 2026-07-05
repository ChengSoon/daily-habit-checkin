import { getDatabase } from "../db/database";
import { createId } from "../utils/id";
import { Habit, HabitFrequency, HabitTrackType } from "./types";

type CreateHabitInput = {
  name: string;
  description: string | null;
  frequency: HabitFrequency;
  reminderTime: string | null;
  isReminderEnabled: boolean;
  trackType: HabitTrackType;
  numericUnit: string | null;
};

export type UpdateHabitInput = CreateHabitInput;

type HabitRow = {
  id: string;
  name: string;
  description: string | null;
  frequency_json: string;
  reminder_time: string | null;
  is_reminder_enabled: number;
  is_paused: number;
  track_type: HabitTrackType;
  numeric_unit: string | null;
  sort_order: number;
  created_at: string;
};

function mapRow(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    frequency: JSON.parse(row.frequency_json),
    reminderTime: row.reminder_time,
    isReminderEnabled: row.is_reminder_enabled === 1,
    isPaused: row.is_paused === 1,
    trackType: row.track_type,
    numericUnit: row.numeric_unit,
    sortOrder: row.sort_order,
    createdAt: row.created_at
  };
}

export async function createHabit(input: CreateHabitInput): Promise<Habit> {
  const db = getDatabase();
  const activeHabits = await listActiveHabits();

  if (activeHabits.length >= 7) {
    throw new Error("最多只能同时管理 7 个活跃习惯");
  }

  const habit: Habit = {
    id: createId("habit"),
    name: input.name,
    description: input.description,
    frequency: input.frequency,
    reminderTime: input.reminderTime,
    isReminderEnabled: input.isReminderEnabled,
    isPaused: false,
    trackType: input.trackType,
    numericUnit: input.numericUnit,
    sortOrder: activeHabits.length,
    createdAt: new Date().toISOString()
  };

  await db.runAsync(
    `INSERT INTO habits (
      id, name, description, frequency_json, reminder_time, is_reminder_enabled,
      is_paused, track_type, numeric_unit, sort_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      habit.id,
      habit.name,
      habit.description,
      JSON.stringify(habit.frequency),
      habit.reminderTime,
      habit.isReminderEnabled ? 1 : 0,
      habit.isPaused ? 1 : 0,
      habit.trackType,
      habit.numericUnit,
      habit.sortOrder,
      habit.createdAt
    ]
  );

  return habit;
}

export async function listActiveHabits(): Promise<Habit[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<HabitRow>(
    "SELECT * FROM habits WHERE is_paused = 0 ORDER BY sort_order ASC, created_at ASC"
  );

  return rows.map(mapRow);
}

export async function listHabits(): Promise<Habit[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<HabitRow>("SELECT * FROM habits ORDER BY is_paused ASC, sort_order ASC, created_at ASC");

  return rows.map(mapRow);
}

export async function getHabitById(id: string): Promise<Habit | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<HabitRow>("SELECT * FROM habits WHERE id = ?", [id]);

  return row ? mapRow(row) : null;
}

export async function updateHabit(id: string, input: UpdateHabitInput): Promise<void> {
  const db = getDatabase();

  await db.runAsync(
    `UPDATE habits SET
      name = ?,
      description = ?,
      frequency_json = ?,
      reminder_time = ?,
      is_reminder_enabled = ?,
      track_type = ?,
      numeric_unit = ?
    WHERE id = ?`,
    [
      input.name,
      input.description,
      JSON.stringify(input.frequency),
      input.reminderTime,
      input.isReminderEnabled ? 1 : 0,
      input.trackType,
      input.numericUnit,
      id
    ]
  );
}

export async function setHabitPaused(id: string, isPaused: boolean): Promise<void> {
  const db = getDatabase();
  await db.runAsync("UPDATE habits SET is_paused = ? WHERE id = ?", [isPaused ? 1 : 0, id]);
}

export async function deleteHabit(id: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync("DELETE FROM habits WHERE id = ?", [id]);
}

export async function moveHabit(id: string, direction: "up" | "down"): Promise<void> {
  const db = getDatabase();
  const habits = await listHabits();
  const currentIndex = habits.findIndex((habit) => habit.id === id);

  if (currentIndex < 0) {
    return;
  }

  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  const current = habits[currentIndex];
  const next = habits[nextIndex];

  if (!current || !next) {
    return;
  }

  await db.runAsync("UPDATE habits SET sort_order = ? WHERE id = ?", [next.sortOrder, current.id]);
  await db.runAsync("UPDATE habits SET sort_order = ? WHERE id = ?", [current.sortOrder, next.id]);
}
