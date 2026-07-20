import { getDatabase } from "../db/database";

const GUIDE_DONE_KEY = "androidReminderGuideDone";

/** 是否已完成过 Android 后台提醒引导（本地标记，不上传）。 */
export async function hasCompletedAndroidReminderGuide(): Promise<boolean> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM local_settings WHERE key = ?",
    [GUIDE_DONE_KEY]
  );
  return row?.value === "true";
}

export async function markAndroidReminderGuideCompleted(): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    "INSERT INTO local_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [GUIDE_DONE_KEY, "true"]
  );
}

export async function resetAndroidReminderGuideForTests(): Promise<void> {
  const db = getDatabase();
  await db.runAsync("DELETE FROM local_settings WHERE key = ?", [GUIDE_DONE_KEY]);
}

export type AndroidReminderGuideStepId =
  | "permission"
  | "battery"
  | "banner"
  | "exactAlarm"
  | "test";

export type AndroidReminderGuideStep = {
  id: AndroidReminderGuideStepId;
  title: string;
  detail: string;
  actionLabel: string;
};

/** 引导步骤文案：对用户只讲「要做什么」，不讲 AlarmManager 原理。 */
export const ANDROID_REMINDER_GUIDE_STEPS: AndroidReminderGuideStep[] = [
  {
    id: "permission",
    title: "1. 允许通知",
    detail: "系统通知权限必须开启，否则任何提醒都不会出现。",
    actionLabel: "开启通知权限"
  },
  {
    id: "battery",
    title: "2. 后台设为无限制",
    detail: "在应用详情 / 耗电管理里关闭「智能限制」「智能优化」，电池策略选「无限制」。否则到点不会触发。",
    actionLabel: "打开应用设置"
  },
  {
    id: "banner",
    title: "3. 打开横幅弹框",
    detail: "通知渠道「打卡提醒」打开「横幅 / 悬浮通知 / 锁屏通知」。只进通知栏、不弹框通常是这里没开。",
    actionLabel: "打开通知设置"
  },
  {
    id: "exactAlarm",
    title: "4. 允许精确闹钟",
    detail: "允许本应用「闹钟和提醒」。不开的话，系统可能把提醒推迟到你重新打开 App。",
    actionLabel: "打开闹钟设置"
  },
  {
    id: "test",
    title: "5. 测一次",
    detail: "点测试后立刻按 Home 回到桌面等约 8 秒。能看到顶部弹框，说明后台提醒正常。",
    actionLabel: "8 秒后测试"
  }
];
