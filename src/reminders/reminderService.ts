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

/** 避免在 vitest/node 中直接 import react-native；web 运行时用 navigator 判断。 */
function isWebRuntime(): boolean {
  return typeof navigator !== "undefined" && typeof window !== "undefined";
}

export { isValidReminderTime, isWithinQuietHours, parseReminderTime };
export type { QuietHours };

const REMINDER_SOURCE = "daily-habit-checkin";
type ReminderKind = "habit" | "eveningSummary";
type ScheduledRequest = Awaited<ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>>[number];

export function configureNotificationHandler(): void {
  if (isWebRuntime()) {
    return;
  }
  void ensureReminderChannel();

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const habitId = notification.request.content.data?.habitId;

      if (typeof habitId === "string") {
        const alreadyDone = await isHabitCompletedOn(habitId, toDateKey(new Date())).catch(() => false);
        if (alreadyDone) {
          return {
            shouldShowBanner: false,
            shouldShowList: false,
            shouldPlaySound: false,
            shouldSetBadge: false
          };
        }
      }

      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false
      };
    }
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

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
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
    content: {
      title: `今天还有 ${input.incompleteCount} 个习惯未完成`,
      body: input.incompleteNames.join("、"),
      sound: "default",
      data: {
        reminderSource: REMINDER_SOURCE,
        reminderKind: "eveningSummary",
        dateKey: toDateKey(date)
      }
    },
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

async function ensureReminderChannel(): Promise<void> {
  if (isWebRuntime()) {
    return;
  }
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: "打卡提醒",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 250]
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
      content: {
        title: `该打卡了：${plan.habit.name}`,
        body: "完成后点一下，今天就算坚持住了。",
        sound: "default",
        data: {
          reminderSource: REMINDER_SOURCE,
          reminderKind: "habit",
          habitId: plan.habit.id,
          dateKey: plan.dateKey
        }
      },
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
  if (!kind || (filter.kind && kind !== filter.kind)) {
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

  return title?.startsWith("今天还有 ") ? "eveningSummary" : null;
}

function getReminderHabitId(request: ScheduledRequest): string | null {
  const habitId = request.content.data?.habitId;
  return typeof habitId === "string" ? habitId : null;
}

function isReminderKind(value: unknown): value is ReminderKind {
  return value === "habit" || value === "eveningSummary";
}
