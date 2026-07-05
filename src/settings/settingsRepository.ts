import { getDatabase } from "../db/database";

export type AppSettings = {
  isEveningSummaryEnabled: boolean;
  eveningSummaryTime: string;
};

const DEFAULT_SETTINGS: AppSettings = {
  isEveningSummaryEnabled: false,
  eveningSummaryTime: "21:30"
};

export async function getAppSettings(): Promise<AppSettings> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM app_settings");
  const values = new Map(rows.map((row) => [row.key, row.value]));

  return {
    isEveningSummaryEnabled: values.get("isEveningSummaryEnabled") === "true",
    eveningSummaryTime: values.get("eveningSummaryTime") ?? DEFAULT_SETTINGS.eveningSummaryTime
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
}
