import { Habit, HabitFrequency } from "./types";

export function shouldRunOnDate(frequency: HabitFrequency, date: Date): boolean {
  const day = date.getDay();

  if (frequency.type === "daily") {
    return true;
  }

  if (frequency.type === "weekdays") {
    return day >= 1 && day <= 5;
  }

  return frequency.daysOfWeek.includes(day);
}

export function isHabitActive(habit: Habit): boolean {
  return !habit.isPaused;
}
