import { getAppSettings } from "../settings/settingsRepository";
import { eachDateKey } from "../utils/date";
import { buildCurrentWeekDays } from "../utils/week";
import { listActiveHabits } from "../habits/habitRepository";
import { shouldRunOnDate } from "../habits/habitRules";
import type { Habit } from "../habits/types";
import { listAllCheckIns } from "./checkinRepository";
import { calculateCurrentStreak } from "./stats";
import type { CheckIn } from "./types";

function groupByHabit(checkIns: CheckIn[], habits: Habit[]): Map<string, CheckIn[]> {
  const groups = new Map(habits.map((habit) => [habit.id, [] as CheckIn[]]));
  for (const checkIn of checkIns) groups.get(checkIn.habitId)?.push(checkIn);
  return groups;
}

function buildStreaks(habits: Habit[], checkInsByHabit: Map<string, CheckIn[]>, today: string) {
  const streaks: Record<string, number> = {};
  for (const habit of habits) {
    const scheduledDates = eachDateKey(habit.createdAt.slice(0, 10), today).filter((date) =>
      shouldRunOnDate(habit.frequency, new Date(`${date}T00:00:00`))
    );
    streaks[habit.id] = calculateCurrentStreak({
      today,
      scheduledDates,
      checkIns: checkInsByHabit.get(habit.id) ?? []
    });
  }
  return streaks;
}

function buildWeekDoneKeys(activeHabits: Habit[], checkInsByHabit: Map<string, CheckIn[]>, today: string) {
  const doneKeys: string[] = [];
  for (const day of buildCurrentWeekDays()) {
    if (day.dateKey >= today) continue;
    const scheduled = activeHabits.filter((habit) =>
      !habit.isPaused && shouldRunOnDate(habit.frequency, new Date(`${day.dateKey}T00:00:00`))
    );
    const allDone = scheduled.length > 0 && scheduled.every((habit) =>
      (checkInsByHabit.get(habit.id) ?? []).some(
        (checkIn) => checkIn.date === day.dateKey && checkIn.status === "completed"
      )
    );
    if (allDone) doneKeys.push(day.dateKey);
  }
  return doneKeys;
}

export async function loadTodayData(today: string) {
  const activeHabits = await listActiveHabits();
  const habits = activeHabits.filter((habit) =>
    shouldRunOnDate(habit.frequency, new Date(`${today}T00:00:00`))
  );
  const allCheckIns = await listAllCheckIns();
  const checkInsByHabit = groupByHabit(allCheckIns, activeHabits);
  const todayHabitIds = new Set(habits.map((habit) => habit.id));
  const todayCheckIns = allCheckIns.filter(
    (checkIn) => checkIn.date === today && todayHabitIds.has(checkIn.habitId)
  );
  const completedIds = new Set(
    todayCheckIns.filter((checkIn) => checkIn.status === "completed").map((checkIn) => checkIn.habitId)
  );
  const streaks = buildStreaks(habits, checkInsByHabit, today);
  const weekDoneKeys = buildWeekDoneKeys(activeHabits, checkInsByHabit, today);
  const settings = await getAppSettings();
  return {
    activeHabits,
    habits,
    todayCheckIns,
    completedIds,
    streaks,
    weekDoneKeys,
    settings,
    incompleteNames: habits.filter((habit) => !completedIds.has(habit.id)).map((habit) => habit.name)
  };
}
