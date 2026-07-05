import { router } from "expo-router";
import { useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { requestAIHabitPlan } from "../../src/ai/aiClient";
import { createHabit } from "../../src/habits/habitRepository";
import { HabitFrequency, HabitTrackType } from "../../src/habits/types";
import { scheduleHabitReminder } from "../../src/reminders/reminderService";
import { Screen } from "../../src/ui/Screen";

type CurrentLevel = "beginner" | "some_experience" | "stable";
type ReminderPreference = "morning" | "noon" | "evening" | "custom";
type FrequencyType = "daily" | "weekdays";

function toFrequency(type: FrequencyType): HabitFrequency {
  return type === "weekdays" ? { type: "weekdays" } : { type: "daily" };
}

export default function NewHabitScreen() {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [goalText, setGoalText] = useState("");
  const [description, setDescription] = useState("");
  const [currentLevel, setCurrentLevel] = useState<CurrentLevel>("beginner");
  const [durationDays, setDurationDays] = useState<7 | 21>(7);
  const [dailyMinutes, setDailyMinutes] = useState("10");
  const [frequencyType, setFrequencyType] = useState<FrequencyType>("daily");
  const [reminderPreference, setReminderPreference] = useState<ReminderPreference>("evening");
  const [customReminderTime, setCustomReminderTime] = useState("21:30");
  const [trackType, setTrackType] = useState<HabitTrackType>("check");
  const [numericUnit, setNumericUnit] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generatePlan() {
    setIsLoading(true);
    setError(null);

    try {
      const plan = await requestAIHabitPlan({
        goalText,
        currentLevel,
        durationDays,
        dailyAvailableMinutes: Number(dailyMinutes),
        expectedFrequency: toFrequency(frequencyType),
        reminderPreference,
        customReminderTime: reminderPreference === "custom" ? customReminderTime : null,
        preferredTrackType: trackType
      });

      router.push({
        pathname: "/plan-preview",
        params: { plan: JSON.stringify(plan), goalText, frequencyType }
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "生成失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveManualHabit() {
    setError(null);

    try {
      const habit = await createHabit({
        name: goalText,
        description: description || null,
        frequency: toFrequency(frequencyType),
        reminderTime: customReminderTime || null,
        isReminderEnabled: Boolean(customReminderTime),
        trackType,
        numericUnit: trackType === "numeric" ? numericUnit || "次" : null
      });

      await scheduleHabitReminder(habit);
      router.replace("/(tabs)/habits");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "保存失败");
    }
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title="AI 制定" onPress={() => setMode("ai")} color={mode === "ai" ? "#2F6B4F" : undefined} />
        <Button title="手动创建" onPress={() => setMode("manual")} color={mode === "manual" ? "#2F6B4F" : undefined} />
      </View>
      <Text>想培养什么习惯？</Text>
      <TextInput
        value={goalText}
        onChangeText={setGoalText}
        placeholder="例如：我想每天运动"
        style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }}
      />
      {mode === "manual" ? (
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="描述，例如 睡前阅读 10 分钟"
          style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }}
        />
      ) : null}
      {mode === "ai" ? (
        <>
          <Text>当前基础</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button title="新手" onPress={() => setCurrentLevel("beginner")} color={currentLevel === "beginner" ? "#2F6B4F" : undefined} />
            <Button title="有基础" onPress={() => setCurrentLevel("some_experience")} color={currentLevel === "some_experience" ? "#2F6B4F" : undefined} />
            <Button title="稳定做过" onPress={() => setCurrentLevel("stable")} color={currentLevel === "stable" ? "#2F6B4F" : undefined} />
          </View>
          <Text>计划周期</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="7 天" onPress={() => setDurationDays(7)} color={durationDays === 7 ? "#2F6B4F" : undefined} />
            <Button title="21 天" onPress={() => setDurationDays(21)} color={durationDays === 21 ? "#2F6B4F" : undefined} />
          </View>
          <TextInput
            value={dailyMinutes}
            onChangeText={setDailyMinutes}
            keyboardType="numeric"
            placeholder="每天可投入分钟数"
            style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }}
          />
        </>
      ) : null}
      <Text>频率</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title="每天" onPress={() => setFrequencyType("daily")} color={frequencyType === "daily" ? "#2F6B4F" : undefined} />
        <Button title="工作日" onPress={() => setFrequencyType("weekdays")} color={frequencyType === "weekdays" ? "#2F6B4F" : undefined} />
      </View>
      {mode === "ai" ? (
        <>
          <Text>提醒偏好</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button title="早上" onPress={() => setReminderPreference("morning")} color={reminderPreference === "morning" ? "#2F6B4F" : undefined} />
            <Button title="中午" onPress={() => setReminderPreference("noon")} color={reminderPreference === "noon" ? "#2F6B4F" : undefined} />
            <Button title="晚上" onPress={() => setReminderPreference("evening")} color={reminderPreference === "evening" ? "#2F6B4F" : undefined} />
            <Button title="自定义" onPress={() => setReminderPreference("custom")} color={reminderPreference === "custom" ? "#2F6B4F" : undefined} />
          </View>
        </>
      ) : null}
      <TextInput
        value={customReminderTime}
        onChangeText={setCustomReminderTime}
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
      {error ? <Text>{error}</Text> : null}
      {mode === "ai" ? (
        <Button title={isLoading ? "生成中..." : "让 AI 制定计划"} onPress={generatePlan} disabled={!goalText || isLoading} />
      ) : (
        <Button title="保存习惯" onPress={saveManualHabit} disabled={!goalText} />
      )}
    </Screen>
  );
}
