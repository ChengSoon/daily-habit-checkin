import { useCallback, useEffect, useRef, useState } from "react";
import { selectCurrentIsland, type CurrentIsland } from "../../adventure/currentIsland";
import { loadAdventureState } from "../../adventure/adventureService";
import { completeCheckInWithXp, listCheckInsForHabit, undoCheckInWithXp } from "../../checkins/checkinRepository";
import { getStreakMilestone } from "../../checkins/milestones";
import { calculateCurrentStreak } from "../../checkins/stats";
import { loadTodayData } from "../../checkins/todayData";
import type { CheckIn } from "../../checkins/types";
import { canUndoCheckIn, CHECKIN_UNDO_WINDOW_MS } from "../../checkins/undoWindow";
import { shouldRunOnDate } from "../../habits/habitRules";
import type { Habit } from "../../habits/types";
import { usePetOptional } from "../../pet";
import { createCheckInCompletedEvent } from "../../pet/companionEventBridge";
import { rescheduleHabitReminders, rescheduleTodayEveningSummary } from "../../reminders/reminderService";
import { eachDateKey, todayKey } from "../../utils/date";
import { getWallet } from "../../xp/xpRepository";
import type { FullCelebration } from "../CheckInCelebration";
import type { HabitCompleter } from "../HabitRow";
import { useSyncScreen } from "../SyncScreen";
import { useCouple } from "../useCouple";

function useTodayModel() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [numericHabit, setNumericHabit] = useState<Habit | null>(null);
  const [numericValue, setNumericValue] = useState("");
  const [miniBurst, setMiniBurst] = useState<{ key: number; habitName: string } | null>(null);
  const [fullCelebration, setFullCelebration] = useState<FullCelebration | null>(null);
  const [xpBalance, setXpBalance] = useState(0);
  const [xpGain, setXpGain] = useState<{ amount: number; key: number } | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoNow, setUndoNow] = useState(() => new Date());
  const [weekDoneKeys, setWeekDoneKeys] = useState<string[]>([]);
  const [island, setIsland] = useState<CurrentIsland | null>(null);
  const miniBurstKey = useRef(0);
  const xpGainKey = useRef(0);
  return { habits, setHabits, checkIns, setCheckIns, streaks, setStreaks, numericHabit, setNumericHabit,
    numericValue, setNumericValue, miniBurst, setMiniBurst, fullCelebration, setFullCelebration,
    xpBalance, setXpBalance, xpGain, setXpGain, isUndoing, setIsUndoing, undoNow, setUndoNow,
    weekDoneKeys, setWeekDoneKeys, island, setIsland, miniBurstKey, xpGainKey };
}

type TodayModel = ReturnType<typeof useTodayModel>;

function useUndoExpiration(model: TodayModel) {
  const { checkIns, undoNow, setUndoNow } = model;
  useEffect(() => {
    const undoable = checkIns.filter(
      (checkIn) => checkIn.status === "completed" && canUndoCheckIn(checkIn, undoNow)
    );
    if (undoable.length === 0) return;
    const nextExpiresAt = Math.min(
      ...undoable.map((checkIn) => new Date(checkIn.createdAt).getTime() + CHECKIN_UNDO_WINDOW_MS)
    );
    const timer = setTimeout(() => setUndoNow(new Date()), Math.max(0, nextExpiresAt - Date.now() + 1));
    return () => clearTimeout(timer);
  }, [checkIns, setUndoNow, undoNow]);
}

async function refreshTodayReminders(data: Awaited<ReturnType<typeof loadTodayData>>) {
  await rescheduleHabitReminders({
    habits: data.activeHabits,
    completedHabitIds: data.completedIds,
    quietHours: {
      isEnabled: data.settings.isQuietHoursEnabled,
      start: data.settings.quietHoursStart,
      end: data.settings.quietHoursEnd
    }
  });
  await rescheduleTodayEveningSummary({
    isEnabled: data.settings.isEveningSummaryEnabled,
    incompleteNames: data.incompleteNames,
    time: data.settings.eveningSummaryTime
  });
}

function useTodayLoad(today: string, model: TodayModel) {
  const { setCheckIns, setHabits, setIsland, setStreaks, setWeekDoneKeys, setXpBalance } = model;
  return useCallback(async () => {
    const data = await loadTodayData(today);
    const wallet = await getWallet();
    const adventure = await loadAdventureState().catch(() => null);
    setXpBalance(wallet.balance);
    setIsland(selectCurrentIsland(adventure));
    setHabits(data.habits);
    setCheckIns(data.todayCheckIns);
    setStreaks(data.streaks);
    setWeekDoneKeys(data.weekDoneKeys);
    try {
      await refreshTodayReminders(data);
    } catch (error) {
      console.warn("Failed to reschedule reminders", error);
    }
  }, [setCheckIns, setHabits, setIsland, setStreaks, setWeekDoneKeys, setXpBalance, today]);
}

async function calculateCompletion(options: { habit: Habit; today: string; xpBalance: number; value: number | null }) {
  const { habit, today, xpBalance, value } = options;
  const result = await completeCheckInWithXp({ habitId: habit.id, date: today, value, note: null });
  const scheduledDates = eachDateKey(habit.createdAt.slice(0, 10), today).filter((date) =>
    shouldRunOnDate(habit.frequency, new Date(`${date}T00:00:00`))
  );
  const habitCheckIns = await listCheckInsForHabit(habit.id);
  const streak = calculateCurrentStreak({ today, scheduledDates, checkIns: habitCheckIns });
  const transactionGain = result.insertedTransactions.reduce(
    (sum, transaction) => sum + Math.max(transaction.amount, 0), 0
  );
  return {
    result,
    streak,
    milestone: getStreakMilestone(streak),
    gained: transactionGain > 0 ? transactionGain : Math.max(0, result.wallet.balance - xpBalance)
  };
}

function showXpGain(model: TodayModel, gained: number) {
  if (gained <= 0) return model.setXpGain(null);
  model.xpGainKey.current += 1;
  model.setXpGain({ amount: gained, key: model.xpGainKey.current });
}

function notifyPet(options: {
  pet: ReturnType<typeof usePetOptional>;
  habit: Habit;
  outcome: Awaited<ReturnType<typeof calculateCompletion>>;
  allDone: boolean;
}) {
  const { pet, habit, outcome, allDone } = options;
  pet?.notifyCheckIn({ habitName: habit.name, streak: outcome.streak, allDone, milestoneDays: outcome.milestone });
  pet?.emitCompanionEvent(createCheckInCompletedEvent({
    checkInId: outcome.result.checkIn.id,
    habitId: habit.id,
    streak: outcome.streak,
    allDone,
    milestoneDays: outcome.milestone,
    occurredAt: new Date()
  }));
}

function useTodayActions(options: {
  today: string;
  model: TodayModel;
  remaining: Habit[];
  reload: () => Promise<void>;
  pet: ReturnType<typeof usePetOptional>;
}) {
  const { today, model, remaining, reload, pet } = options;
  const showMiniBurst = (habitName: string) => {
    model.miniBurstKey.current += 1;
    model.setMiniBurst({ key: model.miniBurstKey.current, habitName });
  };
  const complete = async (habit: Habit, value: number | null, fromNumeric = false) => {
    if (fromNumeric) showMiniBurst(habit.name);
    const allDone = remaining.length === 1 && remaining[0].id === habit.id;
    const outcome = await calculateCompletion({ habit, today, xpBalance: model.xpBalance, value });
    showXpGain(model, outcome.gained);
    model.setXpBalance(outcome.result.wallet.balance);
    model.setNumericHabit(null);
    model.setNumericValue("");
    await reload();
    model.setUndoNow(new Date());
    if (outcome.milestone !== null) {
      model.setFullCelebration({ kind: "milestone", days: outcome.milestone, habitName: habit.name });
    } else if (allDone) model.setFullCelebration({ kind: "allDone" });
    notifyPet({ pet, habit, outcome, allDone });
  };
  const startComplete = (habit: Habit) => {
    if (habit.trackType !== "numeric") return void complete(habit, null);
    model.setNumericHabit(habit);
    model.setNumericValue("");
  };
  return { complete, showMiniBurst, startComplete };
}

function useUndoAction(today: string, model: TodayModel, reload: () => Promise<void>) {
  return async (habit: Habit, checkIn: CheckIn) => {
    if (model.isUndoing || !canUndoCheckIn(checkIn, new Date())) return;
    model.setIsUndoing(true);
    model.setFullCelebration(null);
    try {
      const result = await undoCheckInWithXp({ habitId: habit.id, date: today, checkInId: checkIn.id });
      model.setXpBalance(result.wallet.balance);
      model.setXpGain(null);
      await reload();
      model.setUndoNow(new Date());
    } finally {
      model.setIsUndoing(false);
    }
  };
}

function buildCompletionMaps(checkIns: CheckIn[], byId: ReturnType<typeof useCouple>["byId"]) {
  const completers: Record<string, HabitCompleter> = {};
  const byHabit: Record<string, CheckIn> = {};
  for (const checkIn of checkIns) {
    if (checkIn.status === "completed") byHabit[checkIn.habitId] = checkIn;
    const person = checkIn.createdBy ? byId[checkIn.createdBy] : null;
    if (checkIn.status === "completed" && person) {
      completers[checkIn.habitId] = { name: person.name, tone: person.tone, imageUri: person.avatarUrl };
    }
  }
  return { completers, checkInsByHabit: byHabit };
}

export function useTodayController() {
  const today = todayKey();
  const model = useTodayModel();
  useUndoExpiration(model);
  const load = useTodayLoad(today, model);
  const sync = useSyncScreen(load);
  const couple = useCouple();
  const pet = usePetOptional();
  const completedIds = new Set(model.checkIns.filter((item) => item.status === "completed").map((item) => item.habitId));
  const remaining = model.habits.filter((habit) => !completedIds.has(habit.id));
  const done = model.habits.filter((habit) => completedIds.has(habit.id));
  const actions = useTodayActions({ today, model, remaining, reload: sync.reload, pet });
  const undo = useUndoAction(today, model, sync.reload);
  const maps = buildCompletionMaps(model.checkIns, couple.byId);
  const people = couple.people.map((person) => ({ name: person.name, tone: person.tone, imageUri: person.avatarUrl }));
  const cancelNumeric = () => {
    model.setNumericHabit(null);
    model.setNumericValue("");
  };
  return { ...model, ...sync, ...actions, ...maps, couple, people, completedIds, remaining, done, undo, cancelNumeric };
}
