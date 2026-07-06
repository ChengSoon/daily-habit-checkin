import { fetchSettings, saveSettings } from "../sync/settingsClient";

export type ThemeMode = "system" | "light" | "dark";

export type AppSettings = {
  isEveningSummaryEnabled: boolean;
  eveningSummaryTime: string;
  themeMode: ThemeMode;
  isQuietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
};

const DEFAULT_SETTINGS: AppSettings = {
  isEveningSummaryEnabled: false,
  eveningSummaryTime: "21:30",
  themeMode: "system",
  isQuietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  aiBaseUrl: "",
  aiApiKey: "",
  aiModel: ""
};

function parseThemeMode(value: string | undefined): ThemeMode {
  return value === "light" || value === "dark" || value === "system" ? value : DEFAULT_SETTINGS.themeMode;
}

export async function getAppSettings(): Promise<AppSettings> {
  const values = await fetchSettings("app");

  return {
    isEveningSummaryEnabled: values.isEveningSummaryEnabled === "true",
    eveningSummaryTime: values.eveningSummaryTime ?? DEFAULT_SETTINGS.eveningSummaryTime,
    themeMode: parseThemeMode(values.themeMode),
    isQuietHoursEnabled: values.isQuietHoursEnabled === "true",
    quietHoursStart: values.quietHoursStart ?? DEFAULT_SETTINGS.quietHoursStart,
    quietHoursEnd: values.quietHoursEnd ?? DEFAULT_SETTINGS.quietHoursEnd,
    aiBaseUrl: values.aiBaseUrl ?? DEFAULT_SETTINGS.aiBaseUrl,
    aiApiKey: values.aiApiKey ?? DEFAULT_SETTINGS.aiApiKey,
    aiModel: values.aiModel ?? DEFAULT_SETTINGS.aiModel
  };
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  await saveSettings("app", {
    isEveningSummaryEnabled: String(settings.isEveningSummaryEnabled),
    eveningSummaryTime: settings.eveningSummaryTime,
    themeMode: settings.themeMode,
    isQuietHoursEnabled: String(settings.isQuietHoursEnabled),
    quietHoursStart: settings.quietHoursStart,
    quietHoursEnd: settings.quietHoursEnd,
    aiBaseUrl: settings.aiBaseUrl,
    aiApiKey: settings.aiApiKey,
    aiModel: settings.aiModel
  });
}
