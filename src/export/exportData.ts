import { listAllCheckIns } from "../checkins/checkinRepository";
import { getPlanForHabit } from "../ai/habitPlanRepository";
import { listHabits } from "../habits/habitRepository";
import { getAppSettings } from "../settings/settingsRepository";

export type ExportBundle = {
  version: 1;
  exportedAt: string;
  habits: unknown[];
  checkIns: unknown[];
  plans: unknown[];
  settings: unknown;
};

export async function buildExportBundle(): Promise<ExportBundle> {
  const habits = await listHabits();
  const checkIns = await listAllCheckIns();
  const settings = await getAppSettings();
  const plans = (await Promise.all(habits.map((habit) => getPlanForHabit(habit.id)))).filter(
    (plan) => plan !== null
  );

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    habits,
    checkIns,
    plans,
    settings
  };
}

export async function buildExportJson(): Promise<string> {
  const bundle = await buildExportBundle();
  return JSON.stringify(bundle, null, 2);
}
