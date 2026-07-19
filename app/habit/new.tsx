import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { requestAIHabitPlan } from "../../src/ai/aiClient";
import { createHabit } from "../../src/habits/habitRepository";
import { HabitFrequency, HabitTrackType } from "../../src/habits/types";
import { refreshScheduledReminders } from "../../src/reminders/reminderService";
import {
  AppButton,
  AppText,
  HelperText,
  Label,
  SectionCard,
  SegmentedControl,
  SwitchRow,
  TextField,
  WeekdayPicker
} from "../../src/ui/Controls";
import { Screen } from "../../src/ui/Screen";
import { TimePickerField } from "../../src/ui/TimeWheelPicker";

type CurrentLevel = "beginner" | "some_experience" | "stable";
type ReminderPreference = "morning" | "noon" | "evening" | "custom";
type FrequencyType = "daily" | "weekdays" | "weekly";

function toFrequency(type: FrequencyType, weeklyDays: number[]): HabitFrequency {
  if (type === "weekdays") {
    return { type: "weekdays" };
  }
  if (type === "weekly") {
    return { type: "weekly", daysOfWeek: [...weeklyDays].sort((a, b) => a - b) };
  }
  return { type: "daily" };
}

export default function NewHabitScreen() {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [goalText, setGoalText] = useState("");
  const [description, setDescription] = useState("");
  const [currentLevel, setCurrentLevel] = useState<CurrentLevel>("beginner");
  const [durationDays, setDurationDays] = useState<7 | 21>(7);
  const [dailyMinutes, setDailyMinutes] = useState("10");
  const [frequencyType, setFrequencyType] = useState<FrequencyType>("daily");
  const [weeklyDays, setWeeklyDays] = useState<number[]>([1, 3, 5]);
  const [reminderPreference, setReminderPreference] = useState<ReminderPreference>("evening");
  const [customReminderTime, setCustomReminderTime] = useState("21:30");
  // 手动模式：是否开启提醒（关闭则不设提醒时间）。
  const [isManualReminderEnabled, setIsManualReminderEnabled] = useState(true);
  const [trackType, setTrackType] = useState<HabitTrackType>("check");
  const [numericUnit, setNumericUnit] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 选了“每周”却没勾任何一天时，频率无效，禁用提交
  const frequencyInvalid = frequencyType === "weekly" && weeklyDays.length === 0;

  async function generatePlan() {
    setIsLoading(true);
    setError(null);

    // 选择器产出的时间恒为合法 "HH:MM"，无需再校验。
    const customReminder = reminderPreference === "custom" ? customReminderTime : null;

    try {
      const plan = await requestAIHabitPlan({
        goalText,
        currentLevel,
        durationDays,
        dailyAvailableMinutes: Number(dailyMinutes),
        expectedFrequency: toFrequency(frequencyType, weeklyDays),
        reminderPreference,
        customReminderTime: customReminder,
        preferredTrackType: trackType
      });

      router.push({
        pathname: "/plan-preview",
        params: {
          plan: JSON.stringify(plan),
          goalText,
          frequencyType,
          weeklyDays: weeklyDays.join(",")
        }
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "生成失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveManualHabit() {
    setError(null);

    // 开关关闭表示不提醒；开启则用选择器选定的时间（恒为合法 "HH:MM"）。
    const reminderTime = isManualReminderEnabled ? customReminderTime : null;

    try {
      await createHabit({
        name: goalText,
        description: description || null,
        frequency: toFrequency(frequencyType, weeklyDays),
        reminderTime,
        isReminderEnabled: isManualReminderEnabled,
        trackType,
        numericUnit: trackType === "numeric" ? numericUnit || "次" : null
      });

      await refreshScheduledReminders();
      router.replace("/(tabs)/habits");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "保存失败");
    }
  }

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <AppText variant="display">新增习惯</AppText>
        <AppText variant="body" tone="muted">
          给小岛开辟一个新角落，或让 AI 生成分阶段计划
        </AppText>
      </View>
      <SegmentedControl<"ai" | "manual">
        value={mode}
        onChange={setMode}
        options={[
          { label: "AI 制定", value: "ai" },
          { label: "手动创建", value: "manual" }
        ]}
      />

      <SectionCard title={mode === "ai" ? "想培养什么习惯" : "习惯信息"}>
        <TextField
          label="目标"
          value={goalText}
          onChangeText={setGoalText}
          placeholder="例如：我想每天运动"
        />
        {mode === "manual" ? (
          <TextField
            label="描述"
            value={description}
            onChangeText={setDescription}
            placeholder="例如：睡前阅读 10 分钟"
          />
        ) : null}
      </SectionCard>

      {mode === "ai" ? (
        <SectionCard title="告诉 AI 更多">
          <View style={{ gap: 8 }}>
            <Label>当前基础</Label>
            <SegmentedControl<CurrentLevel>
              value={currentLevel}
              onChange={setCurrentLevel}
              options={[
                { label: "新手", value: "beginner" },
                { label: "有基础", value: "some_experience" },
                { label: "稳定做过", value: "stable" }
              ]}
            />
          </View>
          <View style={{ gap: 8 }}>
            <Label>计划周期</Label>
            <SegmentedControl<7 | 21>
              value={durationDays}
              onChange={setDurationDays}
              options={[
                { label: "7 天", value: 7 },
                { label: "21 天", value: 21 }
              ]}
            />
          </View>
          <TextField
            label="每天可投入（分钟）"
            value={dailyMinutes}
            onChangeText={setDailyMinutes}
            keyboardType="numeric"
            placeholder="10"
          />
        </SectionCard>
      ) : null}

      <SectionCard title="频率与提醒">
        <View style={{ gap: 8 }}>
          <Label>频率</Label>
          <SegmentedControl<FrequencyType>
            value={frequencyType}
            onChange={setFrequencyType}
            options={[
              { label: "每天", value: "daily" },
              { label: "工作日", value: "weekdays" },
              { label: "每周", value: "weekly" }
            ]}
          />
          {frequencyType === "weekly" ? (
            <WeekdayPicker value={weeklyDays} onChange={setWeeklyDays} />
          ) : null}
        </View>
        {mode === "ai" ? (
          <View style={{ gap: 8 }}>
            <Label>提醒偏好</Label>
            <SegmentedControl<ReminderPreference>
              value={reminderPreference}
              onChange={setReminderPreference}
              options={[
                { label: "早上", value: "morning" },
                { label: "中午", value: "noon" },
                { label: "晚上", value: "evening" },
                { label: "自定义", value: "custom" }
              ]}
            />
          </View>
        ) : null}
        {mode === "manual" ? (
          <>
            <SwitchRow
              label="开启提醒"
              description="到点提醒你完成这个习惯"
              value={isManualReminderEnabled}
              onValueChange={setIsManualReminderEnabled}
            />
            {isManualReminderEnabled ? (
              <TimePickerField
                label="提醒时间"
                value={customReminderTime}
                onChange={setCustomReminderTime}
              />
            ) : null}
          </>
        ) : reminderPreference === "custom" ? (
          <TimePickerField
            label="提醒时间"
            value={customReminderTime}
            onChange={setCustomReminderTime}
          />
        ) : null}
      </SectionCard>

      <SectionCard title="记录方式">
        <SegmentedControl<HabitTrackType>
          value={trackType}
          onChange={setTrackType}
          options={[
            { label: "一键完成", value: "check" },
            { label: "数值记录", value: "numeric" }
          ]}
        />
        {trackType === "numeric" ? (
          <TextField
            label="单位"
            value={numericUnit}
            onChangeText={setNumericUnit}
            placeholder="例如：分钟、页、次"
          />
        ) : null}
      </SectionCard>

      {error ? <HelperText tone="danger">{error}</HelperText> : null}

      {mode === "ai" ? (
        <AppButton
          title={isLoading ? "生成中…" : "生成计划"}
          icon="sparkles"
          fullWidth
          onPress={generatePlan}
          disabled={!goalText || isLoading || frequencyInvalid}
        />
      ) : (
        <AppButton
          title="保存为岛上新角落"
          icon="add"
          fullWidth
          onPress={saveManualHabit}
          disabled={!goalText || frequencyInvalid}
        />
      )}
    </Screen>
  );
}
