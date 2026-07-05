import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Button, View } from "react-native";
import { listHabits, moveHabit } from "../../src/habits/habitRepository";
import { Habit } from "../../src/habits/types";
import { EmptyState } from "../../src/ui/EmptyState";
import { HabitRow } from "../../src/ui/HabitRow";
import { Screen } from "../../src/ui/Screen";

export default function HabitsScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);

  const load = useCallback(() => {
    listHabits().then(setHabits);
  }, []);

  useFocusEffect(load);

  async function move(id: string, direction: "up" | "down") {
    await moveHabit(id, direction);
    load();
  }

  return (
    <Screen>
      <Button title="新增习惯" onPress={() => router.push("/habit/new")} />
      {habits.length === 0 ? (
        <EmptyState title="没有习惯" body="用 AI 生成一个入门计划，或者手动创建。" />
      ) : (
        habits.map((habit, index) => (
          <View key={habit.id} style={{ gap: 8 }}>
            <HabitRow
              habit={habit}
              isCompleted={false}
              onComplete={() => router.push("/(tabs)")}
              onOpen={() => router.push({ pathname: "/habit/[id]", params: { id: habit.id } })}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="上移" onPress={() => move(habit.id, "up")} disabled={index === 0} />
              <Button title="下移" onPress={() => move(habit.id, "down")} disabled={index === habits.length - 1} />
            </View>
          </View>
        ))
      )}
    </Screen>
  );
}
