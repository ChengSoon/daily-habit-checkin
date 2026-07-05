import * as SQLite from "expo-sqlite";
import { runMigrations } from "./migrations";

let database: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!database) {
    database = SQLite.openDatabaseSync("daily_habits.db");
  }

  return database;
}

export async function initializeDatabase(): Promise<void> {
  await runMigrations(getDatabase());
}

export async function resetDatabaseForTests(): Promise<void> {
  const db = getDatabase();
  await db.execAsync(`
    DELETE FROM reminder_settings;
    DELETE FROM habit_plans;
    DELETE FROM check_ins;
    DELETE FROM habits;
  `);
}
