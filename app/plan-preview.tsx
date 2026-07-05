import { router, useLocalSearchParams } from "expo-router";
import { Button, Text, View } from "react-native";
import { AIPlanPreview } from "../src/ai/types";
import { createHabit } from "../src/habits/habitRepository";
import { Screen } from "../src/ui/Screen";

export default function PlanPreviewScreen() {
  const params = useLocalSearchParams<{ plan: string; goalText: string }>();
  const plan = JSON.parse(params.plan) as AIPlanPreview;

  async function savePlan() {
    await createHabit({
      name: plan.habitName,
      description: plan.description,
      frequency: { type: "daily" },
      reminderTime: plan.recommendedReminderTime,
      isReminderEnabled: true,
      trackType: plan.recommendedTrackType,
      numericUnit: plan.numericUnit
    });

    router.replace("/(tabs)/habits");
  }

  return (
    <Screen>
      <Text>{plan.habitName}</Text>
      <Text>{plan.description}</Text>
      <Text>{plan.durationDays} 天计划</Text>
      {plan.dailyActions.map((item) => (
        <View key={item.day}>
          <Text>
            第 {item.day} 天：{item.action}
          </Text>
        </View>
      ))}
      <Text>提醒时间：{plan.recommendedReminderTime}</Text>
      <Text>{plan.fallbackAdvice}</Text>
      {plan.safetyNote ? <Text>{plan.safetyNote}</Text> : null}
      <Button title="保存计划" onPress={savePlan} />
    </Screen>
  );
}
