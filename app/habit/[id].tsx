import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { getAdjustmentSuggestion } from "../../src/ai/adjustmentRules";
import { listCheckInsForHabit } from "../../src/checkins/checkinRepository";
import { calculateCurrentStreak, calculateMonthlyCompletionRate } from "../../src/checkins/stats";
import { CheckIn } from "../../src/checkins/types";
import { getHabitById } from "../../src/habits/habitRepository";
import { Habit } from "../../src/habits/types";
import { Screen } from "../../src/ui/Screen";
import { todayKey } from "../../src/utils/date";

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);

  useEffect(() => {
    if (!id) {
      return;
    }

    getHabitById(id).then(setHabit);
    listCheckInsForHabit(id).then(setCheckIns);
  }, [id]);

  if (!habit) {
    return (
      <Screen>
        <Text>加载中...</Text>
      </Screen>
    );
  }

  const scheduledDates = checkIns.map((checkIn) => checkIn.date);
  const currentStreak = calculateCurrentStreak({ today: todayKey(), scheduledDates, checkIns });
  const completionRate = calculateMonthlyCompletionRate({ scheduledDates, checkIns });
  const suggestion = getAdjustmentSuggestion({
    completionRate7Days: completionRate,
    currentStreak,
    planEnded: false
  });

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: "800" }}>{habit.name}</Text>
      <Text>当前连续：{currentStreak} 天</Text>
      <Text>本月完成率：{completionRate}%</Text>
      <Text>提醒时间：{habit.reminderTime ?? "未设置"}</Text>
      {suggestion ? (
        <>
          <Text>{suggestion.title}</Text>
          <Text>{suggestion.body}</Text>
        </>
      ) : null}
    </Screen>
  );
}
