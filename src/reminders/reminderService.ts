import * as Notifications from "expo-notifications";
import { isHabitCompletedOn } from "../checkins/checkinRepository";
import { listActiveHabits } from "../habits/habitRepository";
import { shouldRunOnDate } from "../habits/habitRules";
import { Habit } from "../habits/types";
import { getAppSettings } from "../settings/settingsRepository";
import { toDateKey } from "../utils/date";
import {
  buildHabitReminderPlans,
  dateKeyToDate,
  getNextReminderDate,
  isValidReminderTime,
  isWithinQuietHours,
  parseReminderTime,
  REMINDER_CHANNEL_ID
} from "./reminderPlan";
import type { QuietHours } from "./reminderPlan";

/**
 * 判断是否浏览器/Web 运行时。
 * 不能用 window/navigator：RN/Expo 原生也会 polyfill 二者，误判会导致权限请求直接 return false。
 * 也不 import react-native.Platform：vitest node 环境加载 RN 会失败。
 * document.createElement 是可靠浏览器信号；vitest/node 与原生均无完整 document。
 */
function isWebRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  );
}

export { isValidReminderTime, isWithinQuietHours, parseReminderTime };
export type { QuietHours };

const REMINDER_SOURCE = "daily-habit-checkin";
type ReminderKind = "habit" | "eveningSummary" | "test";
type ScheduledRequest = Awaited<ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>>[number];

const SHOW_BEHAVIOR = {
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: true,
  shouldSetBadge: false
} as const;

/**
 * 前台收到通知时的展示策略。
 * 必须在 3 秒内同步返回；禁止在这里打网络——否则超时会被系统直接丢弃。
 * 已完成习惯的过滤在 schedule 阶段完成（completedHabitIds）。
 */
export function configureNotificationHandler(): void {
  if (isWebRuntime()) {
    return;
  }
  void ensureReminderChannel();

  Notifications.setNotificationHandler({
    handleNotification: async () => ({ ...SHOW_BEHAVIOR })
  });
}

export type ReminderPermissionStatus = "granted" | "denied" | "undetermined";

export async function getReminderPermissionStatus(): Promise<ReminderPermissionStatus> {
  if (isWebRuntime()) {
    return "undetermined";
  }
  const current = await Notifications.getPermissionsAsync();

  if (current.granted) {
    return "granted";
  }

  if (current.canAskAgain) {
    return "undetermined";
  }

  return "denied";
}

export async function requestReminderPermission(): Promise<boolean> {
  if (isWebRuntime()) {
    return false;
  }
  await ensureReminderChannel();
  const current = await Notifications.getPermissionsAsync();

  if (current.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true
    }
  });
  return requested.granted;
}

/**
 * 打开 Android「精确闹钟 / 闹钟和提醒」设置。
 * 无精确闹钟权限时，系统会把 DATE 触发推迟到 App 回到前台，表现为「只有进 App 才弹」。
 */
function getAndroidPackageName(): string {
  // 不读 expo-constants：vitest/node 会连带加载 react-native 失败。包名与 app.json 保持一致。
  return "com.dailyhabitcheckin.app";
}

async function openAndroidIntent(action: string, extras?: { key: string; value: string }[]): Promise<boolean> {
  try {
    // 动态 require，避免 vitest/node 加载 react-native。
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Linking, Platform } = require("react-native") as typeof import("react-native");
    if (Platform.OS !== "android") {
      await Linking.openSettings();
      return true;
    }
    await Linking.sendIntent(action, extras);
    return true;
  } catch {
    return false;
  }
}

/** 打开 Android「精确闹钟 / 闹钟和提醒」设置。智能优化或无精确闹钟时，后台到点不会弹。 */
export async function openExactAlarmSettings(): Promise<void> {
  if (isWebRuntime()) {
    return;
  }
  const pkg = getAndroidPackageName();
  const opened = await openAndroidIntent("android.settings.REQUEST_SCHEDULE_EXACT_ALARM", [
    { key: "android.provider.extra.APP_PACKAGE", value: pkg }
  ]);
  if (!opened) {
    await openAndroidIntent("android.settings.APPLICATION_DETAILS_SETTINGS").catch(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Linking } = require("react-native") as typeof import("react-native");
        await Linking.openSettings();
      } catch {
        // ignore
      }
    });
  }
}

/** 打开应用详情页，引导用户设置电池/后台「无限制」。 */
export async function openAppDetailsSettings(): Promise<void> {
  if (isWebRuntime()) {
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Linking } = require("react-native") as typeof import("react-native");
    // 应用详情是各品牌改电池策略的统一入口
    await Linking.openSettings();
  } catch {
    // ignore
  }
}

/** 打开系统通知设置，便于用户打开「横幅 / 悬浮通知」。 */
export async function openAppNotificationSettings(): Promise<void> {
  if (isWebRuntime()) {
    return;
  }
  const pkg = getAndroidPackageName();
  const opened = await openAndroidIntent("android.settings.APP_NOTIFICATION_SETTINGS", [
    { key: "android.provider.extra.APP_PACKAGE", value: pkg },
    { key: "app_package", value: pkg }
  ]);
  if (!opened) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Linking } = require("react-native") as typeof import("react-native");
      await Linking.openSettings();
    } catch {
      // ignore
    }
  }
}

/**
 * 调度一条 N 秒后的测试系统通知。
 * 验收方式：点按钮后立刻按 Home 退到桌面，等待横幅——能弹说明后台系统通知链路通。
 */
export async function scheduleTestSystemReminder(delaySeconds = 8): Promise<string | null> {
  if (isWebRuntime()) {
    return null;
  }

  const hasPermission = await requestReminderPermission();
  if (!hasPermission) {
    return null;
  }

  await ensureReminderChannel();
  const seconds = Math.max(3, Math.min(Math.floor(delaySeconds), 60));

  return Notifications.scheduleNotificationAsync({
    identifier: `${REMINDER_SOURCE}:test:${Date.now()}`,
    content: buildReminderContent({
      title: "提醒测试",
      body: "若已退到桌面仍看到这条，说明后台系统通知正常。",
      data: {
        reminderSource: REMINDER_SOURCE,
        reminderKind: "test"
      }
    }),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: REMINDER_CHANNEL_ID
    }
  });
}

export async function rescheduleHabitReminders(input: {
  habits: Habit[];
  completedHabitIds: Set<string>;
  quietHours?: QuietHours;
  now?: Date;
  horizonDays?: number;
}): Promise<string[]> {
  if (isWebRuntime()) {
    return [];
  }
  await cancelAppReminderRequests({ kind: "habit" });

  const hasPermission = await requestReminderPermission();
  if (!hasPermission) {
    return [];
  }

  return scheduleHabitReminderPlans(input);
}

export async function scheduleEveningSummary(input: {
  incompleteCount: number;
  incompleteNames: string[];
  time: string;
  now?: Date;
}): Promise<string | null> {
  if (isWebRuntime()) {
    return null;
  }
  if (input.incompleteCount === 0) {
    return null;
  }

  const reminderTime = input.time.trim();
  if (!isValidReminderTime(reminderTime)) {
    return null;
  }

  const hasPermission = await requestReminderPermission();
  if (!hasPermission) {
    return null;
  }

  const date = getNextReminderDate(reminderTime, input.now);
  return Notifications.scheduleNotificationAsync({
    identifier: `${REMINDER_SOURCE}:eveningSummary:${toDateKey(date)}`,
    content: buildReminderContent({
      title: `今天还有 ${input.incompleteCount} 个习惯未完成`,
      body: input.incompleteNames.join("、"),
      data: {
        reminderSource: REMINDER_SOURCE,
        reminderKind: "eveningSummary",
        dateKey: toDateKey(date)
      }
    }),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: REMINDER_CHANNEL_ID
    }
  });
}

export async function rescheduleTodayEveningSummary(input: {
  isEnabled: boolean;
  incompleteNames: string[];
  time: string;
  now?: Date;
}): Promise<string | null> {
  await cancelAppReminderRequests({ kind: "eveningSummary" });

  if (!input.isEnabled || input.incompleteNames.length === 0) {
    return null;
  }

  return scheduleEveningSummary({
    incompleteCount: input.incompleteNames.length,
    incompleteNames: input.incompleteNames,
    time: input.time,
    now: input.now
  });
}

export async function refreshScheduledReminders(now = new Date()): Promise<void> {
  if (isWebRuntime()) {
    return;
  }

  const [habits, settings] = await Promise.all([listActiveHabits(), getAppSettings()]);
  const today = toDateKey(now);
  const todayHabits = habits.filter((habit) => shouldRunOnDate(habit.frequency, dateKeyToDate(today)));
  const completedHabitIds = await getCompletedHabitIds(todayHabits, today);
  const incompleteNames = todayHabits.filter((habit) => !completedHabitIds.has(habit.id)).map((habit) => habit.name);

  await rescheduleHabitReminders({
    habits,
    completedHabitIds,
    quietHours: {
      isEnabled: settings.isQuietHoursEnabled,
      start: settings.quietHoursStart,
      end: settings.quietHoursEnd
    },
    now
  });
  await rescheduleTodayEveningSummary({
    isEnabled: settings.isEveningSummaryEnabled,
    incompleteNames,
    time: settings.eveningSummaryTime,
    now
  });
}

function buildReminderContent(input: {
  title: string;
  body: string;
  data: Record<string, unknown>;
}): Notifications.NotificationContentInput {
  return {
    title: input.title,
    body: input.body,
    sound: "default",
    // Android 后台横幅依赖高优先级；无精确闹钟时仍可能被推迟，但有权限时更稳
    priority: Notifications.AndroidNotificationPriority.MAX,
    data: input.data
  };
}

async function ensureReminderChannel(): Promise<void> {
  if (isWebRuntime()) {
    return;
  }
  // 渠道重要性创建后不可改，升级 channelId 才能提高重要性 / 恢复横幅
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: "打卡提醒",
    description: "习惯到点提醒，需允许横幅/悬浮通知",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 250],
    enableLights: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    showBadge: true,
    // ALARM 用法在多数国产 ROM 上更容易出横幅，而不只是静默进通知栏
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      flags: {
        enforceAudibility: true,
        requestHardwareAudioVideoSynchronization: false
      }
    }
  });
}

async function scheduleHabitReminderPlans(input: {
  habits: Habit[];
  completedHabitIds: Set<string>;
  quietHours?: QuietHours;
  now?: Date;
  horizonDays?: number;
}): Promise<string[]> {
  const ids: string[] = [];
  const plans = buildHabitReminderPlans(input);

  for (const plan of plans) {
    const id = await Notifications.scheduleNotificationAsync({
      identifier: `${REMINDER_SOURCE}:habit:${plan.habit.id}:${plan.dateKey}`,
      content: buildReminderContent({
        title: `该打卡了：${plan.habit.name}`,
        body: "完成后点一下，今天就算坚持住了。",
        data: {
          reminderSource: REMINDER_SOURCE,
          reminderKind: "habit",
          habitId: plan.habit.id,
          dateKey: plan.dateKey
        }
      }),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: plan.date,
        channelId: REMINDER_CHANNEL_ID
      }
    });
    ids.push(id);
  }

  return ids;
}

async function getCompletedHabitIds(habits: Habit[], dateKey: string): Promise<Set<string>> {
  const entries = await Promise.all(
    habits.map(async (habit) => {
      const isDone = await isHabitCompletedOn(habit.id, dateKey).catch(() => false);
      return isDone ? habit.id : null;
    })
  );
  return new Set(entries.filter((id): id is string => id !== null));
}

async function cancelAppReminderRequests(filter: { kind?: ReminderKind; habitId?: string }): Promise<void> {
  // web 无本地通知调度能力，避免 getAllScheduledNotificationsAsync 抛错拖垮整页加载
  if (isWebRuntime()) {
    return;
  }
  const requests = await Notifications.getAllScheduledNotificationsAsync();
  const ownedIds = requests
    .filter((request) => shouldCancelRequest(request, filter))
    .map((request) => request.identifier);

  await Promise.all(ownedIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

function shouldCancelRequest(request: ScheduledRequest, filter: { kind?: ReminderKind; habitId?: string }): boolean {
  const kind = getReminderKind(request);
  if (!kind || kind === "test") {
    // 测试通知不参与业务 cancel；指定 kind=test 时仍可精确清理
    if (filter.kind === "test") {
      return kind === "test";
    }
    if (!filter.kind) {
      return kind !== null && kind !== "test";
    }
    return false;
  }
  if (filter.kind && kind !== filter.kind) {
    return false;
  }

  const habitId = getReminderHabitId(request);
  return !filter.habitId || habitId === filter.habitId;
}

function getReminderKind(request: ScheduledRequest): ReminderKind | null {
  const data = request.content.data;
  const title = request.content.title;

  if (data?.reminderSource === REMINDER_SOURCE && isReminderKind(data.reminderKind)) {
    return data.reminderKind;
  }

  if (typeof data?.habitId === "string" || title?.startsWith("该打卡了：")) {
    return "habit";
  }

  if (title === "提醒测试") {
    return "test";
  }

  return title?.startsWith("今天还有 ") ? "eveningSummary" : null;
}

function getReminderHabitId(request: ScheduledRequest): string | null {
  const habitId = request.content.data?.habitId;
  return typeof habitId === "string" ? habitId : null;
}

function isReminderKind(value: unknown): value is ReminderKind {
  return value === "habit" || value === "eveningSummary" || value === "test";
}
