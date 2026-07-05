import type { SQLiteDatabase } from "expo-sqlite";

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      frequency_json TEXT NOT NULL,
      reminder_time TEXT,
      is_reminder_enabled INTEGER NOT NULL,
      is_paused INTEGER NOT NULL,
      track_type TEXT NOT NULL,
      numeric_unit TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS check_ins (
      id TEXT PRIMARY KEY NOT NULL,
      habit_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      value REAL,
      note TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(habit_id, date),
      FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS habit_plans (
      id TEXT PRIMARY KEY NOT NULL,
      habit_id TEXT NOT NULL,
      duration_days INTEGER NOT NULL,
      goal_text TEXT NOT NULL,
      daily_actions_json TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      current_stage TEXT NOT NULL,
      created_by TEXT NOT NULL,
      FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminder_settings (
      habit_id TEXT PRIMARY KEY NOT NULL,
      habit_reminder_time TEXT,
      is_habit_reminder_enabled INTEGER NOT NULL,
      is_evening_summary_enabled INTEGER NOT NULL,
      evening_summary_time TEXT NOT NULL,
      quiet_hours_start TEXT,
      quiet_hours_end TEXT,
      FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
}
