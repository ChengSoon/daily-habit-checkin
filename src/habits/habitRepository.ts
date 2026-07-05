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
    createdAt: row.created_at
  };
}

export async function createHabit(input: CreateHabitInput): Promise<Habit> {
  const db = getDatabase();
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
    createdAt: new Date().toISOString()
  };

  await db.runAsync(
    `INSERT INTO habits (
      id, name, description, frequency_json, reminder_time, is_reminder_enabled,
      is_paused, track_type, numeric_unit, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      habit.createdAt
    ]
  );

  return habit;
}

export async function listActiveHabits(): Promise<Habit[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<HabitRow>(
    "SELECT * FROM habits WHERE is_paused = 0 ORDER BY created_at ASC"
  );

  return rows.map(mapRow);
}

export async function getHabitById(id: string): Promise<Habit | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<HabitRow>("SELECT * FROM habits WHERE id = ?", [id]);

  return row ? mapRow(row) : null;
}
