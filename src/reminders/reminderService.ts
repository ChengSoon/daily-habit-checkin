import * as Notifications from "expo-notifications";
import { Habit } from "../habits/types";

export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false
    })
  });
}

export function parseReminderTime(time: string): { hour: number; minute: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);

  if (!match) {
    throw new Error("Invalid reminder time");
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
}

function getNextReminderDate(time: string, now = new Date()): Date {
  const { hour, minute } = parseReminderTime(time);
  const reminderDate = new Date(now);
  reminderDate.setHours(hour, minute, 0, 0);

  if (reminderDate <= now) {
    reminderDate.setDate(reminderDate.getDate() + 1);
  }

  return reminderDate;
}

export async function requestReminderPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();

  if (current.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleHabitReminder(habit: Habit): Promise<string | null> {
  if (!habit.isReminderEnabled || !habit.reminderTime || habit.isPaused) {
    return null;
  }

  const hasPermission = await requestReminderPermission();

  if (!hasPermission) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `该打卡了：${habit.name}`,
      body: "完成后点一下，今天就算坚持住了。"
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: getNextReminderDate(habit.reminderTime)
    }
  });
}

let habitNotificationIds: string[] = [];

export async function rescheduleHabitReminders(input: {
  habits: Habit[];
  completedHabitIds: Set<string>;
}): Promise<string[]> {
  await Promise.all(habitNotificationIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  habitNotificationIds = [];

  const ids: string[] = [];

  for (const habit of input.habits) {
    if (input.completedHabitIds.has(habit.id)) {
      continue;
    }

    const id = await scheduleHabitReminder(habit);
    if (id) {
      ids.push(id);
    }
  }

  habitNotificationIds = ids;
  return ids;
}

export async function scheduleEveningSummary(input: {
  incompleteCount: number;
  incompleteNames: string[];
  time: string;
}): Promise<string | null> {
  if (input.incompleteCount === 0) {
    return null;
  }

  const hasPermission = await requestReminderPermission();

  if (!hasPermission) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `今天还有 ${input.incompleteCount} 个习惯未完成`,
      body: input.incompleteNames.join("、")
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: getNextReminderDate(input.time)
    }
  });
}

let eveningSummaryNotificationId: string | null = null;

export async function rescheduleTodayEveningSummary(input: {
  isEnabled: boolean;
  incompleteNames: string[];
  time: string;
}): Promise<string | null> {
  if (eveningSummaryNotificationId) {
    await Notifications.cancelScheduledNotificationAsync(eveningSummaryNotificationId);
    eveningSummaryNotificationId = null;
  }

  if (!input.isEnabled || input.incompleteNames.length === 0) {
    return null;
  }

  eveningSummaryNotificationId = await scheduleEveningSummary({
    incompleteCount: input.incompleteNames.length,
    incompleteNames: input.incompleteNames,
    time: input.time
  });

  return eveningSummaryNotificationId;
}
