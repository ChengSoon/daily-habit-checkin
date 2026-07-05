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
  sort_order: number;
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

type HabitPlanRow = {
  id: string;
  habit_id: string;
  duration_days: 7 | 21;
  goal_text: string;
  daily_actions_json: string;
  start_date: string;
  end_date: string;
  current_stage: string;
  created_by: "ai" | "manual";
};

type AppSettingRow = {
  key: string;
  value: string;
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
  private habitPlans: HabitPlanRow[] = [];
  private appSettings: AppSettingRow[] = [];

  async execAsync(sql: string): Promise<void> {
    if (sql.includes("DELETE FROM reminder_settings")) {
      this.checkIns = [];
      this.habits = [];
      this.habitPlans = [];
      this.appSettings = [];
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
        sort_order: Number(params[9]),
        created_at: String(params[10])
      });
      return;
    }

    if (sql.includes("UPDATE habits SET") && sql.includes("name = ?")) {
      this.habits = this.habits.map((habit) => {
        if (habit.id !== params[7]) {
          return habit;
        }

        return {
          ...habit,
          name: String(params[0]),
          description: params[1] === null ? null : String(params[1]),
          frequency_json: String(params[2]),
          reminder_time: params[3] === null ? null : String(params[3]),
          is_reminder_enabled: Number(params[4]),
          track_type: params[5] as "check" | "numeric",
          numeric_unit: params[6] === null ? null : String(params[6])
        };
      });
      return;
    }

    if (sql.includes("UPDATE habits SET is_paused = ?")) {
      this.habits = this.habits.map((habit) => {
        return habit.id === params[1] ? { ...habit, is_paused: Number(params[0]) } : habit;
      });
      return;
    }

    if (sql.includes("UPDATE habits SET sort_order = ?")) {
      this.habits = this.habits.map((habit) => {
        return habit.id === params[1] ? { ...habit, sort_order: Number(params[0]) } : habit;
      });
      return;
    }

    if (sql.includes("DELETE FROM habits WHERE id = ?")) {
      this.habits = this.habits.filter((habit) => habit.id !== params[0]);
      this.checkIns = this.checkIns.filter((checkIn) => checkIn.habit_id !== params[0]);
      this.habitPlans = this.habitPlans.filter((plan) => plan.habit_id !== params[0]);
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
      return;
    }

    if (sql.includes("INSERT INTO habit_plans")) {
      this.habitPlans.push({
        id: String(params[0]),
        habit_id: String(params[1]),
        duration_days: params[2] as 7 | 21,
        goal_text: String(params[3]),
        daily_actions_json: String(params[4]),
        start_date: String(params[5]),
        end_date: String(params[6]),
        current_stage: String(params[7]),
        created_by: params[8] as "ai" | "manual"
      });
      return;
    }

    if (sql.includes("INSERT INTO app_settings")) {
      const row = { key: String(params[0]), value: String(params[1]) };
      this.appSettings = this.appSettings.filter((setting) => setting.key !== row.key);
      this.appSettings.push(row);
    }
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (sql.includes("FROM habits WHERE is_paused = 0")) {
      return this.habits
        .filter((habit) => habit.is_paused === 0)
        .sort((left, right) => left.sort_order - right.sort_order) as T[];
    }

    if (sql.includes("FROM habits ORDER BY")) {
      return [...this.habits].sort((left, right) => left.is_paused - right.is_paused || left.sort_order - right.sort_order) as T[];
    }

    if (sql.includes("FROM check_ins WHERE habit_id = ?")) {
      return this.checkIns.filter((checkIn) => checkIn.habit_id === params[0]) as T[];
    }

    if (sql.includes("FROM app_settings")) {
      return this.appSettings as T[];
    }

    return [];
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    if (sql.includes("FROM habits WHERE id = ?")) {
      return (this.habits.find((habit) => habit.id === params[0]) as T | undefined) ?? null;
    }

    if (sql.includes("FROM habit_plans WHERE habit_id = ?")) {
      return (this.habitPlans.find((plan) => plan.habit_id === params[0]) as T | undefined) ?? null;
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
