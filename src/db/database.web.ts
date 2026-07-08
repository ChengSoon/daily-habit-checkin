/**
 * Web 平台的本地存储替身。
 *
 * 业务数据（习惯/打卡/奖励/钱包等）早已全部走云端同步，本地库只剩下
 * `local_settings` 一张键值表，用于保存登录 token 与账号缓存（见 localSettings.ts）。
 * 因此这里只实现 local_settings 的读写，其余表的内存实现已作为死代码移除。
 *
 * 注意：这是纯内存实现，刷新页面即清空——web 端本就把它当临时存储用。
 */

type LocalSettingRow = {
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
  private localSettings: LocalSettingRow[] = [];

  async execAsync(sql: string): Promise<void> {
    if (sql.includes("DELETE FROM local_settings")) {
      this.localSettings = [];
    }
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    if (sql.includes("INSERT INTO local_settings")) {
      const row = { key: String(params[0]), value: String(params[1]) };
      this.localSettings = this.localSettings.filter((setting) => setting.key !== row.key);
      this.localSettings.push(row);
      return;
    }

    if (sql.includes("DELETE FROM local_settings WHERE key = ?")) {
      this.localSettings = this.localSettings.filter((setting) => setting.key !== params[0]);
    }
  }

  async getAllAsync<T>(): Promise<T[]> {
    return [];
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    if (sql.includes("FROM local_settings WHERE key = ?")) {
      return (this.localSettings.find((setting) => setting.key === params[0]) as T | undefined) ?? null;
    }

    return null;
  }
}

let database: FakeSQLiteDatabase | null = null;

export function getDatabase(): SQLiteDatabase {
  if (!database) {
    database = new FakeSQLiteDatabase();
  }

  return database;
}

export async function initializeDatabase(): Promise<void> {
  await getDatabase().execAsync("");
}

export async function resetDatabaseForTests(): Promise<void> {
  await getDatabase().execAsync("DELETE FROM local_settings;");
}
