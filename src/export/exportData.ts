import { listAllCheckIns } from "../checkins/checkinRepository";
import { getPlanForHabit } from "../ai/habitPlanRepository";
import { listHabits } from "../habits/habitRepository";
import { listRedemptions, listRewards } from "../rewards/rewardRepository";
import { getAppSettings } from "../settings/settingsRepository";
import { getWallet, listXpTransactions } from "../xp/xpRepository";

export type ExportBundle = {
  version: 1;
  exportedAt: string;
  habits: unknown[];
  checkIns: unknown[];
  plans: unknown[];
  settings: unknown;
  xp: {
    wallet: unknown;
    transactions: unknown[];
  };
  rewards: {
    items: unknown[];
    redemptions: unknown[];
  };
};

export async function buildExportBundle(): Promise<ExportBundle> {
  const habits = await listHabits();
  const checkIns = await listAllCheckIns();
  const settings = await getAppSettings();
  const plans = (await Promise.all(habits.map((habit) => getPlanForHabit(habit.id)))).filter(
    (plan) => plan !== null
  );
  const wallet = await getWallet();
  const xpTransactions = await listXpTransactions();
  const rewards = await listRewards({ includeArchived: true });
  const rewardRedemptions = await listRedemptions();

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    habits,
    checkIns,
    plans,
    settings,
    xp: {
      wallet,
      transactions: xpTransactions
    },
    rewards: {
      items: rewards,
      redemptions: rewardRedemptions
    }
  };
}

export async function buildExportJson(): Promise<string> {
  const bundle = await buildExportBundle();
  return JSON.stringify(bundle, null, 2);
}
