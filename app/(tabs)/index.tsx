import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Button } from "react-native";
import { completeCheckIn, listCheckInsForHabit } from "../../src/checkins/checkinRepository";
import { CheckIn } from "../../src/checkins/types";
import { listActiveHabits } from "../../src/habits/habitRepository";
import { Habit } from "../../src/habits/types";
import { EmptyState } from "../../src/ui/EmptyState";
import { HabitRow } from "../../src/ui/HabitRow";
import { ProgressHeader } from "../../src/ui/ProgressHeader";
import { Screen } from "../../src/ui/Screen";
import { todayKey } from "../../src/utils/date";

export default function TodayScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const today = todayKey();

  const load = useCallback(async () => {
    const loadedHabits = await listActiveHabits();
    const loadedCheckIns = (await Promise.all(loadedHabits.map((habit) => listCheckInsForHabit(habit.id)))).flat();
    setHabits(loadedHabits);
    setCheckIns(loadedCheckIns.filter((checkIn) => checkIn.date === today));
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function complete(habit: Habit) {
    await completeCheckIn({ habitId: habit.id, date: today, value: null, note: null });
    await load();
  }

  const completedIds = new Set(
    checkIns.filter((checkIn) => checkIn.status === "completed").map((checkIn) => checkIn.habitId)
  );

  return (
    <Screen>
      <ProgressHeader completed={completedIds.size} total={habits.length} />
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
            onComplete={() => complete(habit)}
            onOpen={() => router.push({ pathname: "/habit/[id]", params: { id: habit.id } })}
          />
        ))
      )}
    </Screen>
  );
}
