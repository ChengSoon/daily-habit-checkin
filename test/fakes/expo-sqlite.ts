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

type XpWalletRow = {
  id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  updated_at: string;
};

type XpTransactionRow = {
  id: string;
  unique_key: string;
  amount: number;
  type: "earn" | "spend" | "refund" | "adjust";
  reason:
    | "checkin"
    | "streak_3"
    | "streak_7"
    | "plan_complete"
    | "return_bonus"
    | "reward_redeem"
    | "redemption_cancel";
  habit_id: string | null;
  check_in_id: string | null;
  reward_id: string | null;
  redemption_id: string | null;
  date_key: string | null;
  created_at: string;
};

type RewardRow = {
  id: string;
  title: string;
  description: string | null;
  type: "virtual" | "real_world";
  price_xp: number;
  status: "active" | "archived";
  virtual_kind: "theme" | "celebration" | "title" | "badge" | "card_skin" | "none";
  inventory_limit: number | null;
  image_uri: string | null;
  created_at: string;
  updated_at: string;
};

type RewardRedemptionRow = {
  id: string;
  reward_id: string;
  price_xp: number;
  status: "pending_fulfillment" | "fulfilled" | "cancelled";
  created_at: string;
  fulfilled_at: string | null;
  cancelled_at: string | null;
  note: string | null;
};

type AdminSettingRow = {
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
  private xpWallets: XpWalletRow[] = [];
  private xpTransactions: XpTransactionRow[] = [];
  private rewards: RewardRow[] = [];
  private rewardRedemptions: RewardRedemptionRow[] = [];
  private adminSettings: AdminSettingRow[] = [];

  async execAsync(sql: string): Promise<void> {
    if (sql.includes("DELETE FROM xp_wallet")) {
      this.xpWallets = [];
      this.xpTransactions = [];
      this.rewards = [];
      this.rewardRedemptions = [];
      this.adminSettings = [];
    }

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
      return;
    }

    if (sql.includes("INSERT INTO xp_wallet")) {
      const row: XpWalletRow = {
        id: String(params[0]),
        balance: Number(params[1]),
        lifetime_earned: Number(params[2]),
        lifetime_spent: Number(params[3]),
        updated_at: String(params[4])
      };
      this.xpWallets = this.xpWallets.filter((wallet) => wallet.id !== row.id);
      this.xpWallets.push(row);
      return;
    }

    if (sql.includes("UPDATE xp_wallet SET")) {
      this.xpWallets = this.xpWallets.map((wallet) => {
        if (wallet.id !== params[4]) {
          return wallet;
        }
        return {
          ...wallet,
          balance: wallet.balance + Number(params[0]),
          lifetime_earned: wallet.lifetime_earned + Number(params[1]),
          lifetime_spent: wallet.lifetime_spent + Number(params[2]),
          updated_at: String(params[3])
        };
      });
      return;
    }

    if (sql.includes("INSERT INTO xp_transactions")) {
      if (this.xpTransactions.some((transaction) => transaction.unique_key === params[1])) {
        return;
      }
      this.xpTransactions.push({
        id: String(params[0]),
        unique_key: String(params[1]),
        amount: Number(params[2]),
        type: params[3] as XpTransactionRow["type"],
        reason: params[4] as XpTransactionRow["reason"],
        habit_id: params[5] === null ? null : String(params[5]),
        check_in_id: params[6] === null ? null : String(params[6]),
        reward_id: params[7] === null ? null : String(params[7]),
        redemption_id: params[8] === null ? null : String(params[8]),
        date_key: params[9] === null ? null : String(params[9]),
        created_at: String(params[10])
      });
      return;
    }

    if (sql.includes("INSERT INTO rewards")) {
      const row: RewardRow = {
        id: String(params[0]),
        title: String(params[1]),
        description: params[2] === null ? null : String(params[2]),
        type: params[3] as RewardRow["type"],
        price_xp: Number(params[4]),
        status: params[5] as RewardRow["status"],
        virtual_kind: params[6] as RewardRow["virtual_kind"],
        inventory_limit: params[7] === null ? null : Number(params[7]),
        image_uri: params[8] === null ? null : String(params[8]),
        created_at: String(params[9]),
        updated_at: String(params[10])
      };
      this.rewards = this.rewards.filter((reward) => reward.id !== row.id);
      this.rewards.push(row);
      return;
    }

    if (sql.includes("UPDATE rewards SET")) {
      this.rewards = this.rewards.map((reward) => {
        if (reward.id !== params[9]) {
          return reward;
        }
        return {
          ...reward,
          title: String(params[0]),
          description: params[1] === null ? null : String(params[1]),
          type: params[2] as RewardRow["type"],
          price_xp: Number(params[3]),
          status: params[4] as RewardRow["status"],
          virtual_kind: params[5] as RewardRow["virtual_kind"],
          inventory_limit: params[6] === null ? null : Number(params[6]),
          image_uri: params[7] === null ? null : String(params[7]),
          updated_at: String(params[8])
        };
      });
      return;
    }

    if (sql.includes("INSERT INTO reward_redemptions")) {
      this.rewardRedemptions.push({
        id: String(params[0]),
        reward_id: String(params[1]),
        price_xp: Number(params[2]),
        status: params[3] as RewardRedemptionRow["status"],
        created_at: String(params[4]),
        fulfilled_at: params[5] === null ? null : String(params[5]),
        cancelled_at: params[6] === null ? null : String(params[6]),
        note: params[7] === null ? null : String(params[7])
      });
      return;
    }

    if (sql.includes("UPDATE reward_redemptions SET status = ?")) {
      this.rewardRedemptions = this.rewardRedemptions.map((redemption) => {
        if (redemption.id !== params[3]) {
          return redemption;
        }
        return {
          ...redemption,
          status: params[0] as RewardRedemptionRow["status"],
          fulfilled_at: params[1] === null ? null : String(params[1]),
          cancelled_at: params[2] === null ? null : String(params[2])
        };
      });
      return;
    }

    if (sql.includes("INSERT INTO admin_settings")) {
      const row = { key: String(params[0]), value: String(params[1]) };
      this.adminSettings = this.adminSettings.filter((setting) => setting.key !== row.key);
      this.adminSettings.push(row);
      return;
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

    if (sql.includes("FROM check_ins ORDER BY")) {
      return [...this.checkIns].sort((left, right) => left.date.localeCompare(right.date)) as T[];
    }

    if (sql.includes("FROM app_settings")) {
      return this.appSettings as T[];
    }

    if (sql.includes("FROM xp_transactions")) {
      return [...this.xpTransactions].sort((left, right) => left.created_at.localeCompare(right.created_at)) as T[];
    }

    if (sql.includes("FROM rewards WHERE status = 'active'")) {
      return this.rewards.filter((reward) => reward.status === "active") as T[];
    }

    if (sql.includes("FROM rewards ORDER BY")) {
      return [...this.rewards].sort((left, right) => left.created_at.localeCompare(right.created_at)) as T[];
    }

    if (sql.includes("FROM reward_redemptions")) {
      return [...this.rewardRedemptions].sort((left, right) => right.created_at.localeCompare(left.created_at)) as T[];
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

    if (sql.includes("FROM check_ins WHERE habit_id = ?") && sql.includes("AND date = ?")) {
      return (
        this.checkIns.find((checkIn) => checkIn.habit_id === params[0] && checkIn.date === params[1]) as
          | T
          | undefined
      ) ?? null;
    }

    if (sql.includes("FROM xp_wallet WHERE id = ?")) {
      return (this.xpWallets.find((wallet) => wallet.id === params[0]) as T | undefined) ?? null;
    }

    if (sql.includes("FROM xp_transactions WHERE unique_key = ?")) {
      return (this.xpTransactions.find((transaction) => transaction.unique_key === params[0]) as T | undefined) ?? null;
    }

    if (sql.includes("FROM rewards WHERE id = ?")) {
      return (this.rewards.find((reward) => reward.id === params[0]) as T | undefined) ?? null;
    }

    if (sql.includes("FROM reward_redemptions WHERE id = ?")) {
      return (this.rewardRedemptions.find((redemption) => redemption.id === params[0]) as T | undefined) ?? null;
    }

    if (sql.includes("FROM admin_settings WHERE key = ?")) {
      return (this.adminSettings.find((setting) => setting.key === params[0]) as T | undefined) ?? null;
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
