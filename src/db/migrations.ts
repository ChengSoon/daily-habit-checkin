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
      sort_order INTEGER NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS xp_wallet (
      id TEXT PRIMARY KEY NOT NULL,
      balance INTEGER NOT NULL,
      lifetime_earned INTEGER NOT NULL,
      lifetime_spent INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS xp_transactions (
      id TEXT PRIMARY KEY NOT NULL,
      unique_key TEXT NOT NULL UNIQUE,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      reason TEXT NOT NULL,
      habit_id TEXT,
      check_in_id TEXT,
      reward_id TEXT,
      redemption_id TEXT,
      date_key TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      price_xp INTEGER NOT NULL,
      status TEXT NOT NULL,
      virtual_kind TEXT NOT NULL,
      inventory_limit INTEGER,
      image_uri TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reward_redemptions (
      id TEXT PRIMARY KEY NOT NULL,
      reward_id TEXT NOT NULL,
      price_xp INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      fulfilled_at TEXT,
      cancelled_at TEXT,
      note TEXT,
      FOREIGN KEY(reward_id) REFERENCES rewards(id)
    );

    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  await db.execAsync("ALTER TABLE habits ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;").catch(() => undefined);
  await db.execAsync("ALTER TABLE rewards ADD COLUMN image_uri TEXT;").catch(() => undefined);
}
