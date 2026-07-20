import { beforeEach, describe, expect, it } from "vitest";
import {
  getScheduledNotificationsForTests,
  getConfiguredHandlerForTests,
  resetNotificationsForTests,
  scheduleNotificationAsync,
  SchedulableTriggerInputTypes
} from "../../test/fakes/expo-notifications";
import { Habit } from "../habits/types";
import { toDateKey } from "../utils/date";
import {
  configureNotificationHandler,
  isWithinQuietHours,
  parseReminderTime,
  rescheduleHabitReminders,
  scheduleEveningSummary,
  scheduleTestSystemReminder,
  requestReminderPermission,
  getReminderPermissionStatus
} from "./reminderService";

function buildHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "habit-1",
    name: "阅读",
    description: null,
    frequency: { type: "daily" },
    reminderTime: "21:30",
    isReminderEnabled: true,
    isPaused: false,
    trackType: "check",
    numericUnit: null,
    sortOrder: 0,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides
  };
}

function scheduledDateKeys(): string[] {
  return getScheduledNotificationsForTests().map((request) => toDateKey(new Date(request.trigger.date as Date)));
}

describe("parseReminderTime", () => {
  it("parses HH:mm time", () => {
    expect(parseReminderTime("21:30")).toEqual({ hour: 21, minute: 30 });
  });

  it("rejects invalid time", () => {
    expect(() => parseReminderTime("25:99")).toThrow("Invalid reminder time");
  });
});

describe("isWithinQuietHours", () => {
  it("matches times inside a same-day range", () => {
    expect(isWithinQuietHours("13:00", "12:00", "14:00")).toBe(true);
    expect(isWithinQuietHours("11:59", "12:00", "14:00")).toBe(false);
  });

  it("treats start as inclusive and end as exclusive", () => {
    expect(isWithinQuietHours("12:00", "12:00", "14:00")).toBe(true);
    expect(isWithinQuietHours("14:00", "12:00", "14:00")).toBe(false);
  });

  it("handles ranges that cross midnight", () => {
    expect(isWithinQuietHours("23:00", "22:00", "08:00")).toBe(true);
    expect(isWithinQuietHours("02:30", "22:00", "08:00")).toBe(true);
    expect(isWithinQuietHours("08:00", "22:00", "08:00")).toBe(false);
    expect(isWithinQuietHours("12:00", "22:00", "08:00")).toBe(false);
  });

  it("returns false when start equals end", () => {
    expect(isWithinQuietHours("09:00", "08:00", "08:00")).toBe(false);
  });
});

describe("rescheduleHabitReminders", () => {
  const now = new Date(2026, 6, 8, 10, 0, 0, 0);

  beforeEach(() => {
    resetNotificationsForTests();
  });

  it("cancels stale habit reminders already stored in the system queue", async () => {
    await scheduleNotificationAsync({
      identifier: "old-habit-reminder",
      content: {
        title: "该打卡了：旧习惯",
        data: { habitId: "old-habit" }
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DAILY,
        hour: 7,
        minute: 0
      }
    });

    await rescheduleHabitReminders({
      habits: [],
      completedHabitIds: new Set(),
      now,
      horizonDays: 3
    });

    expect(getScheduledNotificationsForTests()).toHaveLength(0);
  });

  it("skips today after completion but keeps future reminders queued", async () => {
    const habit = buildHabit({ reminderTime: "21:30" });

    await rescheduleHabitReminders({
      habits: [habit],
      completedHabitIds: new Set([habit.id]),
      now,
      horizonDays: 3
    });

    expect(scheduledDateKeys()).toEqual(["2026-07-09", "2026-07-10"]);
  });

  it("only queues reminders on dates matching the habit frequency", async () => {
    const habit = buildHabit({
      frequency: { type: "weekly", daysOfWeek: [3, 5] },
      reminderTime: "21:30"
    });

    await rescheduleHabitReminders({
      habits: [habit],
      completedHabitIds: new Set(),
      now,
      horizonDays: 4
    });

    expect(scheduledDateKeys()).toEqual(["2026-07-08", "2026-07-10"]);
  });

  it("queues habit reminders with default sound and max priority", async () => {
    const habit = buildHabit({ reminderTime: "21:30" });

    await rescheduleHabitReminders({
      habits: [habit],
      completedHabitIds: new Set(),
      now,
      horizonDays: 1
    });

    const content = getScheduledNotificationsForTests()[0]?.content;
    expect(content?.sound).toBe("default");
    expect(content?.priority).toBe("max");
  });
});

describe("configureNotificationHandler", () => {
  beforeEach(() => {
    resetNotificationsForTests();
  });

  it("always allows banners quickly without async data lookups", async () => {
    configureNotificationHandler();

    const handler = getConfiguredHandlerForTests();
    const behavior = await handler?.handleNotification({
      request: {
        content: {
          data: { habitId: "habit-1" }
        }
      }
    });

    expect(behavior).toMatchObject({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true
    });
  });
});

describe("scheduleTestSystemReminder", () => {
  beforeEach(() => {
    resetNotificationsForTests();
  });

  it("queues a short interval system notification for background verification", async () => {
    const id = await scheduleTestSystemReminder(8);
    expect(id).toBeTruthy();
    const scheduled = getScheduledNotificationsForTests();
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.trigger).toMatchObject({
      type: SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 8
    });
    expect(scheduled[0]?.content.priority).toBe("max");
  });
});

describe("scheduleEveningSummary", () => {
  it("skips invalid reminder times instead of rejecting", async () => {
    await expect(
      scheduleEveningSummary({
        incompleteCount: 1,
        incompleteNames: ["读书"],
        time: "21:3"
      })
    ).resolves.toBeNull();
  });
});


describe("requestReminderPermission", () => {
  it("requests permission in non-browser runtimes (vitest/node)", async () => {
    // node 无 document，不应被误判为 web 而直接返回 false
    await expect(requestReminderPermission()).resolves.toBe(true);
    await expect(getReminderPermissionStatus()).resolves.toBe("granted");
  });
});
