/**
 * Web 平台的本地存储替身。
 *
 * 业务数据（习惯/打卡/奖励/钱包等）走云端同步，本地只剩 `local_settings`
 * （登录 token / 账号缓存等，见 localSettings.ts）。
 *
 * 用 localStorage 持久化，避免刷新/全页跳转后登录态丢失（纯内存会阻断二级页验收）。
 */

type LocalSettingRow = {
  key: string;
  value: string;
};

const STORAGE_KEY = "daily-habit-checkin:local_settings";

export type SQLiteDatabase = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<void>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
};

function readStore(): LocalSettingRow[] {
  if (typeof localStorage === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalSettingRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(rows: LocalSettingRow[]): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // quota / private mode：降级为内存态
  }
}

class FakeSQLiteDatabase implements SQLiteDatabase {
  private localSettings: LocalSettingRow[] = readStore();

  private persist(): void {
    writeStore(this.localSettings);
  }

  async execAsync(sql: string): Promise<void> {
    if (sql.includes("DELETE FROM local_settings")) {
      this.localSettings = [];
      this.persist();
    }
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    if (sql.includes("INSERT INTO local_settings")) {
      const row = { key: String(params[0]), value: String(params[1]) };
      this.localSettings = this.localSettings.filter((setting) => setting.key !== row.key);
      this.localSettings.push(row);
      this.persist();
      return;
    }

    if (sql.includes("DELETE FROM local_settings WHERE key = ?")) {
      this.localSettings = this.localSettings.filter((setting) => setting.key !== params[0]);
      this.persist();
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
