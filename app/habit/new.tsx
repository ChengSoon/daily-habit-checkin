import { router } from "expo-router";
import { useState } from "react";
import { Button, Text, TextInput } from "react-native";
import { requestAIHabitPlan } from "../../src/ai/aiClient";
import { Screen } from "../../src/ui/Screen";

export default function NewHabitScreen() {
  const [goalText, setGoalText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generatePlan() {
    setIsLoading(true);
    setError(null);

    try {
      const plan = await requestAIHabitPlan({
        goalText,
        currentLevel: "beginner",
        dailyAvailableMinutes: 10,
        expectedFrequency: { type: "daily" },
        reminderPreference: "evening",
        customReminderTime: null,
        preferredTrackType: "check"
      });

      router.push({
        pathname: "/plan-preview",
        params: { plan: JSON.stringify(plan), goalText }
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "生成失败");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Screen>
      <Text>想培养什么习惯？</Text>
      <TextInput
        value={goalText}
        onChangeText={setGoalText}
        placeholder="例如：我想每天运动"
        style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }}
      />
      {error ? <Text>{error}</Text> : null}
      <Button title={isLoading ? "生成中..." : "让 AI 制定计划"} onPress={generatePlan} disabled={!goalText || isLoading} />
    </Screen>
  );
}
