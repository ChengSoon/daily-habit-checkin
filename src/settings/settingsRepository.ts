import { getDatabase } from "../db/database";

export type ThemeMode = "system" | "light" | "dark";

export type AppSettings = {
  isEveningSummaryEnabled: boolean;
  eveningSummaryTime: string;
  themeMode: ThemeMode;
  isQuietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
};

const DEFAULT_SETTINGS: AppSettings = {
  isEveningSummaryEnabled: false,
  eveningSummaryTime: "21:30",
  themeMode: "system",
  isQuietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00"
};

function parseThemeMode(value: string | undefined): ThemeMode {
  return value === "light" || value === "dark" || value === "system" ? value : DEFAULT_SETTINGS.themeMode;
}

export async function getAppSettings(): Promise<AppSettings> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM app_settings");
  const values = new Map(rows.map((row) => [row.key, row.value]));

  return {
    isEveningSummaryEnabled: values.get("isEveningSummaryEnabled") === "true",
    eveningSummaryTime: values.get("eveningSummaryTime") ?? DEFAULT_SETTINGS.eveningSummaryTime,
    themeMode: parseThemeMode(values.get("themeMode")),
    isQuietHoursEnabled: values.get("isQuietHoursEnabled") === "true",
    quietHoursStart: values.get("quietHoursStart") ?? DEFAULT_SETTINGS.quietHoursStart,
    quietHoursEnd: values.get("quietHoursEnd") ?? DEFAULT_SETTINGS.quietHoursEnd
  };
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const db = getDatabase();

  await db.runAsync(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ["isEveningSummaryEnabled", String(settings.isEveningSummaryEnabled)]
  );
  await db.runAsync(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ["eveningSummaryTime", settings.eveningSummaryTime]
  );
  await db.runAsync(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ["themeMode", settings.themeMode]
  );
  await db.runAsync(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ["isQuietHoursEnabled", String(settings.isQuietHoursEnabled)]
  );
  await db.runAsync(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ["quietHoursStart", settings.quietHoursStart]
  );
  await db.runAsync(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ["quietHoursEnd", settings.quietHoursEnd]
  );
}
