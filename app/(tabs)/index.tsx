import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { completeCheckIn, listCheckInsForHabit } from "../../src/checkins/checkinRepository";
import { CheckIn } from "../../src/checkins/types";
import { listActiveHabits } from "../../src/habits/habitRepository";
import { shouldRunOnDate } from "../../src/habits/habitRules";
import { Habit } from "../../src/habits/types";
import { rescheduleHabitReminders, rescheduleTodayEveningSummary } from "../../src/reminders/reminderService";
import { getAppSettings } from "../../src/settings/settingsRepository";
import { EmptyState } from "../../src/ui/EmptyState";
import { HabitRow } from "../../src/ui/HabitRow";
import { ProgressHeader } from "../../src/ui/ProgressHeader";
import { Screen } from "../../src/ui/Screen";
import { todayKey } from "../../src/utils/date";

export default function TodayScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [numericHabit, setNumericHabit] = useState<Habit | null>(null);
  const [numericValue, setNumericValue] = useState("");
  const today = todayKey();

  const load = useCallback(async () => {
    const activeHabits = await listActiveHabits();
    const loadedHabits = activeHabits.filter((habit) => shouldRunOnDate(habit.frequency, new Date(`${today}T00:00:00`)));
    const loadedCheckIns = (await Promise.all(loadedHabits.map((habit) => listCheckInsForHabit(habit.id)))).flat();
    const todayCheckIns = loadedCheckIns.filter((checkIn) => checkIn.date === today);
    const completedIds = new Set(
      todayCheckIns.filter((checkIn) => checkIn.status === "completed").map((checkIn) => checkIn.habitId)
    );
    const settings = await getAppSettings();
    const incompleteNames = loadedHabits.filter((habit) => !completedIds.has(habit.id)).map((habit) => habit.name);

    setHabits(loadedHabits);
    setCheckIns(todayCheckIns);
    await rescheduleHabitReminders({
      habits: loadedHabits,
      completedHabitIds: completedIds
    });
    await rescheduleTodayEveningSummary({
      isEnabled: settings.isEveningSummaryEnabled,
      incompleteNames,
      time: settings.eveningSummaryTime
    });
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function complete(habit: Habit, value: number | null) {
    await completeCheckIn({ habitId: habit.id, date: today, value, note: null });
    setNumericHabit(null);
    setNumericValue("");
    await load();
  }

  function startComplete(habit: Habit) {
    if (habit.trackType === "numeric") {
      setNumericHabit(habit);
      return;
    }

    complete(habit, null);
  }

  const completedIds = new Set(
    checkIns.filter((checkIn) => checkIn.status === "completed").map((checkIn) => checkIn.habitId)
  );

  return (
    <Screen>
      <ProgressHeader completed={completedIds.size} total={habits.length} />
      {numericHabit ? (
        <View style={{ gap: 8, padding: 12, borderRadius: 8, backgroundColor: "#FFFFFF" }}>
          <Text>
            {numericHabit.name} 完成了多少{numericHabit.numericUnit ?? ""}？
          </Text>
          <TextInput
            value={numericValue}
            onChangeText={setNumericValue}
            keyboardType="numeric"
            style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }}
          />
          <Button title="确认打卡" onPress={() => complete(numericHabit, Number(numericValue))} disabled={!numericValue} />
          <Button title="取消" onPress={() => setNumericHabit(null)} />
        </View>
      ) : null}
      {habits.length === 0 ? (
        <>
          <EmptyState title="还没有习惯" body="先创建一个想坚持的小习惯。" />
          <Button title="新增习惯" onPress={() => router.push("/habit/new")} />
        </>
      ) : (
        habits.map((habit) => (
          <HabitRow
            key={habit.id}
            habit={habit}
            isCompleted={completedIds.has(habit.id)}
            onComplete={() => startComplete(habit)}
            onOpen={() => router.push({ pathname: "/habit/[id]", params: { id: habit.id } })}
          />
        ))
      )}
    </Screen>
  );
}
