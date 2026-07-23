import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Platform, Share } from "react-native";
import { selectCurrentIsland, type CurrentIsland } from "../../adventure/currentIsland";
import { loadAdventureState } from "../../adventure/adventureService";
import { listAllCheckIns } from "../../checkins/checkinRepository";
import { calculateCurrentStreak } from "../../checkins/stats";
import { buildExportJson } from "../../export/exportData";
import { listActiveHabits } from "../../habits/habitRepository";
import { shouldRunOnDate } from "../../habits/habitRules";
import {
  getReminderPermissionStatus,
  refreshScheduledReminders,
  requestReminderPermission,
  scheduleTestSystemReminder,
  type ReminderPermissionStatus
} from "../../reminders/reminderService";
import { getAppSettings, saveAppSettings, type AppSettings } from "../../settings/settingsRepository";
import { getCurrentAccount, type Account } from "../../sync/authService";
import { getCurrentAppVersion } from "../../updates/appVersion";
import { checkForAppUpdate, type AppUpdateCheckResult } from "../../updates/updateClient";
import { eachDateKey, todayKey } from "../../utils/date";
import { getWallet } from "../../xp/xpRepository";
import { useTheme } from "../ThemeContext";
import { useCouple } from "../useCouple";
import type { ProfilePanel } from "./ProfileOverview";

const DEFAULT_SETTINGS: AppSettings = {
  isEveningSummaryEnabled: false,
  eveningSummaryTime: "21:30",
  themeMode: "system",
  themeName: "romance",
  isQuietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  aiBaseUrl: "",
  aiApiKey: "",
  aiModel: ""
};

async function loadMaximumStreak(): Promise<number> {
  const today = todayKey();
  const habits = await listActiveHabits();
  const allCheckIns = await listAllCheckIns();
  let maximum = 0;
  for (const habit of habits) {
    const scheduled = eachDateKey(habit.createdAt.slice(0, 10), today).filter((date) =>
      shouldRunOnDate(habit.frequency, new Date(`${date}T00:00:00`))
    );
    const checks = allCheckIns.filter((checkIn) => checkIn.habitId === habit.id);
    maximum = Math.max(maximum, calculateCurrentStreak({ today, scheduledDates: scheduled, checkIns: checks }));
  }
  return maximum;
}

function useProfileModel() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [permission, setPermission] = useState<ReminderPermissionStatus>("undetermined");
  const [testReminderMessage, setTestReminderMessage] = useState<string | null>(null);
  const [androidGuideVisible, setAndroidGuideVisible] = useState(false);
  const [xpBalance, setXpBalance] = useState(0);
  const [lifetimeEarned, setLifetimeEarned] = useState(0);
  const [account, setAccount] = useState<Account | null>(null);
  const [currentAppVersion] = useState(() => getCurrentAppVersion());
  const [updateResult, setUpdateResult] = useState<AppUpdateCheckResult | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [island, setIsland] = useState<CurrentIsland | null>(null);
  const [badgeCount, setBadgeCount] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [settingsPanel, setSettingsPanel] = useState<ProfilePanel>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  return { settings, setSettings, permission, setPermission, testReminderMessage, setTestReminderMessage,
    androidGuideVisible, setAndroidGuideVisible, xpBalance, setXpBalance, lifetimeEarned, setLifetimeEarned,
    account, setAccount, currentAppVersion, updateResult, setUpdateResult, isCheckingUpdate, setIsCheckingUpdate,
    updateError, setUpdateError, island, setIsland, badgeCount, setBadgeCount, streakDays, setStreakDays,
    settingsPanel, setSettingsPanel, exportError, setExportError };
}

type ProfileModel = ReturnType<typeof useProfileModel>;

function useUpdateCheck(model: ProfileModel) {
  const { currentAppVersion, setIsCheckingUpdate, setUpdateError, setUpdateResult } = model;
  return useCallback(async () => {
    setIsCheckingUpdate(true);
    setUpdateError(null);
    try {
      setUpdateResult(await checkForAppUpdate(currentAppVersion));
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : "更新检查失败");
    } finally {
      setIsCheckingUpdate(false);
    }
  }, [currentAppVersion, setIsCheckingUpdate, setUpdateError, setUpdateResult]);
}

function loadWallet(model: Pick<ProfileModel, "setXpBalance" | "setLifetimeEarned">) {
  return getWallet().then((wallet) => {
    model.setXpBalance(wallet.balance);
    model.setLifetimeEarned(wallet.lifetimeEarned);
  }).catch(() => {
    model.setXpBalance(0);
    model.setLifetimeEarned(0);
  });
}

function loadAdventure(model: Pick<ProfileModel, "setIsland" | "setBadgeCount">) {
  return loadAdventureState().then((adventure) => {
    model.setIsland(selectCurrentIsland(adventure));
    model.setBadgeCount(adventure.chapters.filter((chapter) => chapter.viewStatus === "claimed").length);
  }).catch(() => {
    model.setIsland(null);
    model.setBadgeCount(0);
  });
}

function useProfileRefresh(model: ProfileModel, reloadCouple: () => void, checkUpdates: () => Promise<void>) {
  const { setAccount, setBadgeCount, setIsland, setLifetimeEarned, setPermission, setSettings,
    setStreakDays, setXpBalance } = model;
  useFocusEffect(useCallback(() => {
    void getAppSettings().then(setSettings).catch(() => undefined);
    void getReminderPermissionStatus().then(setPermission);
    void loadWallet({ setXpBalance, setLifetimeEarned });
    void loadMaximumStreak().then(setStreakDays).catch(() => setStreakDays(0));
    void getCurrentAccount().then(setAccount).catch(() => setAccount(null));
    void loadAdventure({ setIsland, setBadgeCount });
    reloadCouple();
    void checkUpdates();
  }, [checkUpdates, reloadCouple, setAccount, setBadgeCount, setIsland, setLifetimeEarned,
    setPermission, setSettings, setStreakDays, setXpBalance]));
}

function useReminderActions(model: ProfileModel) {
  const save = async (next: AppSettings, shouldRefreshReminders = false) => {
    model.setSettings(next);
    await saveAppSettings(next);
    if (shouldRefreshReminders) await refreshScheduledReminders();
  };
  const enablePermission = async () => {
    try {
      const granted = await requestReminderPermission();
      model.setPermission(granted ? "granted" : await getReminderPermissionStatus());
      if (granted) {
        await refreshScheduledReminders();
        if (Platform.OS === "android") model.setAndroidGuideVisible(true);
      }
    } catch {
      model.setPermission(await getReminderPermissionStatus().catch(() => "undetermined" as const));
    }
  };
  const runTestReminder = async () => {
    model.setTestReminderMessage(null);
    try {
      const id = await scheduleTestSystemReminder(8);
      model.setTestReminderMessage(id
        ? "已安排 8 秒后测试。请立刻按 Home 退到桌面等待横幅。"
        : "无法调度测试通知，请先开启通知权限。");
    } catch (error) {
      model.setTestReminderMessage(error instanceof Error ? error.message : "测试通知失败");
    }
  };
  return { save, enablePermission, runTestReminder };
}

function useProfileCommands(model: ProfileModel) {
  const exportData = async () => {
    model.setExportError(null);
    try {
      await Share.share({ title: "习惯打卡数据", message: await buildExportJson() });
    } catch (error) {
      model.setExportError(error instanceof Error ? error.message : "导出失败");
    }
  };
  const downloadUpdate = async () => {
    if (model.updateResult?.status !== "available") return;
    model.setUpdateError(null);
    try {
      await Linking.openURL(model.updateResult.update.downloadUrl);
    } catch (error) {
      model.setUpdateError(error instanceof Error ? error.message : "无法打开下载链接");
    }
  };
  return { exportData, downloadUpdate };
}

export function useProfileController() {
  const theme = useTheme();
  const model = useProfileModel();
  const couple = useCouple();
  const checkUpdates = useUpdateCheck(model);
  useProfileRefresh(model, couple.reload, checkUpdates);
  const reminderActions = useReminderActions(model);
  const commands = useProfileCommands(model);
  const people = couple.people.map((person) => ({
    name: person.name,
    tone: person.tone,
    imageUri: person.avatarUrl
  }));
  return { ...theme, ...model, ...reminderActions, ...commands, couple, people, checkUpdates };
}

export type ProfileController = ReturnType<typeof useProfileController>;
