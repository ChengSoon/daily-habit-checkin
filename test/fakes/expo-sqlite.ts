type HabitRow = {
  id: string;
  name: string;
  description: string | null;
  frequency_json: string;
  reminder_time: string | null;
  is_reminder_enabled: number;
  is_paused: number;
  track_type: "check" | "numeric";
  numeric_unit: string | null;
  created_at: string;
};

type CheckInRow = {
  id: string;
  habit_id: string;
  date: string;
  status: "completed" | "skipped" | "missed";
  value: number | null;
  note: string | null;
  created_at: string;
};

export type SQLiteDatabase = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<void>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
};

class FakeSQLiteDatabase implements SQLiteDatabase {
  private habits: HabitRow[] = [];
  private checkIns: CheckInRow[] = [];

  async execAsync(sql: string): Promise<void> {
    if (sql.includes("DELETE FROM reminder_settings")) {
      this.checkIns = [];
      this.habits = [];
    }
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    if (sql.includes("INSERT INTO habits")) {
      this.habits.push({
        id: String(params[0]),
        name: String(params[1]),
        description: params[2] === null ? null : String(params[2]),
        frequency_json: String(params[3]),
        reminder_time: params[4] === null ? null : String(params[4]),
        is_reminder_enabled: Number(params[5]),
        is_paused: Number(params[6]),
        track_type: params[7] as "check" | "numeric",
        numeric_unit: params[8] === null ? null : String(params[8]),
        created_at: String(params[9])
      });
      return;
    }

    if (sql.includes("INSERT INTO check_ins")) {
      const row: CheckInRow = {
        id: String(params[0]),
        habit_id: String(params[1]),
        date: String(params[2]),
        status: params[3] as "completed" | "skipped" | "missed",
        value: params[4] === null ? null : Number(params[4]),
        note: params[5] === null ? null : String(params[5]),
        created_at: String(params[6])
      };
      this.checkIns = this.checkIns.filter((checkIn) => {
        return !(checkIn.habit_id === row.habit_id && checkIn.date === row.date);
      });
      this.checkIns.push(row);
    }
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (sql.includes("FROM habits WHERE is_paused = 0")) {
      return this.habits.filter((habit) => habit.is_paused === 0) as T[];
    }

    if (sql.includes("FROM check_ins WHERE habit_id = ?")) {
      return this.checkIns.filter((checkIn) => checkIn.habit_id === params[0]) as T[];
    }

    return [];
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    if (sql.includes("FROM habits WHERE id = ?")) {
      return (this.habits.find((habit) => habit.id === params[0]) as T | undefined) ?? null;
    }

    return null;
  }
}

let database: FakeSQLiteDatabase | null = null;

export function openDatabaseSync(): SQLiteDatabase {
  if (!database) {
    database = new FakeSQLiteDatabase();
  }

  return database;
}
