import { shouldRunOnDate } from "../habits/habitRules";
import { Habit } from "../habits/types";
import { addDays, toDateKey } from "../utils/date";

export const REMINDER_CHANNEL_ID = "habit-reminders-v2";
export const REMINDER_HORIZON_DAYS = 7;

const REMINDER_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type QuietHours = {
  isEnabled: boolean;
  start: string;
  end: string;
};

export type HabitReminderPlan = {
  habit: Habit;
  date: Date;
  dateKey: string;
};

export function isValidReminderTime(time: string): boolean {
  return REMINDER_TIME_PATTERN.test(time);
}

export function parseReminderTime(time: string): { hour: number; minute: number } {
  const match = REMINDER_TIME_PATTERN.exec(time);

  if (!match) {
    throw new Error("Invalid reminder time");
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
}

export function isWithinQuietHours(time: string, start: string, end: string): boolean {
  const target = parseReminderTime(time);
  const from = parseReminderTime(start);
  const to = parseReminderTime(end);

  const targetMinutes = target.hour * 60 + target.minute;
  const fromMinutes = from.hour * 60 + from.minute;
  const toMinutes = to.hour * 60 + to.minute;

  if (fromMinutes === toMinutes) {
    return false;
  }

  if (fromMinutes > toMinutes) {
    return targetMinutes >= fromMinutes || targetMinutes < toMinutes;
  }

  return targetMinutes >= fromMinutes && targetMinutes < toMinutes;
}

export function getNextReminderDate(time: string, now = new Date()): Date {
  const reminderDate = dateAtReminderTime(toDateKey(now), time);

  if (reminderDate <= now) {
    return dateAtReminderTime(addDays(toDateKey(now), 1), time);
  }

  return reminderDate;
}

export function buildHabitReminderPlans(input: {
  habits: Habit[];
  completedHabitIds: Set<string>;
  quietHours?: QuietHours;
  now?: Date;
  horizonDays?: number;
}): HabitReminderPlan[] {
  const now = input.now ?? new Date();
  const today = toDateKey(now);
  const dateKeys = getHorizonDateKeys(today, input.horizonDays);

  return input.habits.flatMap((habit) => {
    if (!canScheduleHabit(habit, input.quietHours)) {
      return [];
    }

    return dateKeys.flatMap((dateKey) => {
      const date = dateAtReminderTime(dateKey, habit.reminderTime ?? "");
      if (!shouldScheduleDate(habit, dateKey, date, today, now, input.completedHabitIds)) {
        return [];
      }
      return [{ habit, date, dateKey }];
    });
  });
}

export function dateKeyToDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function canScheduleHabit(habit: Habit, quietHours?: QuietHours): boolean {
  if (!habit.isReminderEnabled || !habit.reminderTime || habit.isPaused || !isValidReminderTime(habit.reminderTime)) {
    return false;
  }

  return !(
    quietHours?.isEnabled &&
    isWithinQuietHours(habit.reminderTime, quietHours.start, quietHours.end)
  );
}

function dateAtReminderTime(dateKey: string, time: string): Date {
  const { hour, minute } = parseReminderTime(time);
  const date = dateKeyToDate(dateKey);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function getHorizonDateKeys(today: string, horizonDays = REMINDER_HORIZON_DAYS): string[] {
  const normalized = Number.isFinite(horizonDays) ? Math.floor(horizonDays) : REMINDER_HORIZON_DAYS;
  const days = Math.max(1, Math.min(normalized, REMINDER_HORIZON_DAYS));
  return Array.from({ length: days }, (_, index) => addDays(today, index));
}

function shouldScheduleDate(
  habit: Habit,
  dateKey: string,
  date: Date,
  today: string,
  now: Date,
  completedHabitIds: Set<string>
): boolean {
  if (date <= now || dateKey < habit.createdAt.slice(0, 10)) {
    return false;
  }

  if (dateKey === today && completedHabitIds.has(habit.id)) {
    return false;
  }

  return shouldRunOnDate(habit.frequency, dateKeyToDate(dateKey));
}
