import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Button } from "react-native";
import { listActiveHabits } from "../../src/habits/habitRepository";
import { Habit } from "../../src/habits/types";
import { EmptyState } from "../../src/ui/EmptyState";
import { HabitRow } from "../../src/ui/HabitRow";
import { Screen } from "../../src/ui/Screen";

export default function HabitsScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);

  useFocusEffect(
    useCallback(() => {
      listActiveHabits().then(setHabits);
    }, [])
  );

  return (
    <Screen>
      <Button title="新增习惯" onPress={() => router.push("/habit/new")} />
      {habits.length === 0 ? (
        <EmptyState title="没有习惯" body="用 AI 生成一个入门计划，或者手动创建。" />
      ) : (
        habits.map((habit) => (
          <HabitRow
            key={habit.id}
            habit={habit}
            isCompleted={false}
            onComplete={() => router.push("/(tabs)")}
            onOpen={() => router.push({ pathname: "/habit/[id]", params: { id: habit.id } })}
          />
        ))
      )}
    </Screen>
  );
}
