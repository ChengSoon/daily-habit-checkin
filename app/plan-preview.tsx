import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { saveAIHabitPlan } from "../src/ai/habitPlanRepository";
import { AIPlanDay, AIPlanPreview } from "../src/ai/types";
import { createHabit } from "../src/habits/habitRepository";
import { HabitFrequency, HabitTrackType } from "../src/habits/types";
import { scheduleHabitReminder } from "../src/reminders/reminderService";
import { Screen } from "../src/ui/Screen";
import { todayKey } from "../src/utils/date";

function toFrequency(type: string | undefined): HabitFrequency {
  return type === "weekdays" ? { type: "weekdays" } : { type: "daily" };
}

export default function PlanPreviewScreen() {
  const params = useLocalSearchParams<{ plan: string; goalText: string; frequencyType?: string }>();
  const plan = JSON.parse(params.plan) as AIPlanPreview;
  const [habitName, setHabitName] = useState(plan.habitName);
  const [description, setDescription] = useState(plan.description);
  const [reminderTime, setReminderTime] = useState(plan.recommendedReminderTime);
  const [trackType, setTrackType] = useState<HabitTrackType>(plan.recommendedTrackType);
  const [numericUnit, setNumericUnit] = useState(plan.numericUnit ?? "");
  const [fallbackAdvice, setFallbackAdvice] = useState(plan.fallbackAdvice);
  const [dailyActions, setDailyActions] = useState<AIPlanDay[]>(plan.dailyActions);
  const [error, setError] = useState<string | null>(null);

  function updateAction(day: number, action: string) {
    setDailyActions((items) => {
      return items.map((item) => (item.day === day ? { ...item, action } : item));
    });
  }

  async function savePlan() {
    setError(null);

    try {
      const editablePlan: AIPlanPreview = {
        ...plan,
        habitName,
        description,
        dailyActions,
        recommendedReminderTime: reminderTime,
        recommendedTrackType: trackType,
        numericUnit: trackType === "numeric" ? numericUnit || "次" : null,
        fallbackAdvice
      };

      const habit = await createHabit({
        name: editablePlan.habitName,
        description: editablePlan.description,
        frequency: toFrequency(params.frequencyType),
        reminderTime: editablePlan.recommendedReminderTime,
        isReminderEnabled: Boolean(editablePlan.recommendedReminderTime),
        trackType: editablePlan.recommendedTrackType,
        numericUnit: editablePlan.numericUnit
      });

      await saveAIHabitPlan({
        habitId: habit.id,
        goalText: params.goalText,
        startDate: todayKey(),
        preview: editablePlan
      });
      await scheduleHabitReminder(habit);

      router.replace("/(tabs)/habits");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "保存失败");
    }
  }

  return (
    <Screen>
      <Text style={{ fontSize: 24, fontWeight: "800" }}>预览并编辑 AI 计划</Text>
      <TextInput
        value={habitName}
        onChangeText={setHabitName}
        placeholder="习惯名称"
        style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }}
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="描述"
        style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }}
      />
      <Text>{plan.durationDays} 天计划</Text>
      {dailyActions.map((item) => (
        <View key={item.day} style={{ gap: 6 }}>
          <Text>第 {item.day} 天</Text>
          <TextInput
            value={item.action}
            onChangeText={(value) => updateAction(item.day, value)}
            style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }}
          />
        </View>
      ))}
      <TextInput
        value={reminderTime}
        onChangeText={setReminderTime}
        placeholder="提醒时间 21:30"
        style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }}
      />
      <Text>记录方式</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title="一键完成" onPress={() => setTrackType("check")} color={trackType === "check" ? "#2F6B4F" : undefined} />
        <Button title="数值记录" onPress={() => setTrackType("numeric")} color={trackType === "numeric" ? "#2F6B4F" : undefined} />
      </View>
      {trackType === "numeric" ? (
        <TextInput
          value={numericUnit}
          onChangeText={setNumericUnit}
          placeholder="单位，例如 分钟、页、次"
          style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }}
        />
      ) : null}
      <TextInput
        value={fallbackAdvice}
        onChangeText={setFallbackAdvice}
        placeholder="降低难度建议"
        style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }}
      />
      {plan.safetyNote ? <Text>{plan.safetyNote}</Text> : null}
      {error ? <Text>{error}</Text> : null}
      <Button title="保存计划" onPress={savePlan} disabled={!habitName || !description || dailyActions.some((item) => !item.action)} />
      <Button title="取消" onPress={() => router.back()} />
    </Screen>
  );
}
