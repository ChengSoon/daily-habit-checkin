import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { saveAIHabitPlan } from "../src/ai/habitPlanRepository";
import { AIPlanDay, AIPlanPreview } from "../src/ai/types";
import { createHabit } from "../src/habits/habitRepository";
import { HabitFrequency, HabitTrackType } from "../src/habits/types";
import { refreshScheduledReminders } from "../src/reminders/reminderService";
import {
  AppButton,
  AppText,
  Card,
  HelperText,
  Label,
  SectionCard,
  SegmentedControl,
  TextField
} from "../src/ui/Controls";
import { Screen } from "../src/ui/Screen";
import { TimePickerField } from "../src/ui/TimeWheelPicker";
import { radius, spacing, type Palette } from "../src/ui/theme";
import { useTheme } from "../src/ui/ThemeContext";
import { todayKey } from "../src/utils/date";

const PHASE_TINTS: { bg: keyof Palette; fg: keyof Palette }[] = [
  { bg: "candySkySurface", fg: "candySky" },
  { bg: "partnerSurface", fg: "partnerInk" },
  { bg: "candyOrangeSurface", fg: "candyOrange" }
];

function toFrequency(type: string | undefined, weeklyDays: number[]): HabitFrequency {
  if (type === "weekdays") {
    return { type: "weekdays" };
  }
  if (type === "weekly") {
    return { type: "weekly", daysOfWeek: [...weeklyDays].sort((a, b) => a - b) };
  }
  return { type: "daily" };
}

export default function PlanPreviewScreen() {
  const params = useLocalSearchParams<{
    plan: string;
    goalText: string;
    frequencyType?: string;
    weeklyDays?: string;
  }>();
  const plan = JSON.parse(params.plan) as AIPlanPreview;
  const { colors } = useTheme();
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
        frequency: toFrequency(
          params.frequencyType,
          params.weeklyDays ? (JSON.parse(params.weeklyDays) as number[]) : []
        ),
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
      await refreshScheduledReminders();

      router.replace("/(tabs)/habits");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "保存失败");
    }
  }

  const canSave = Boolean(habitName) && Boolean(description) && dailyActions.every((item) => item.action);

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">预览 AI 计划</AppText>
        <AppText variant="body" tone="muted">
          {plan.durationDays} 天计划 · 确认前可自由编辑
        </AppText>
      </View>

      {plan.safetyNote ? (
        <Card tone="tint">
          <AppText variant="caption" tone="primary">
            安全提示
          </AppText>
          <AppText variant="body" tone="soft">
            {plan.safetyNote}
          </AppText>
        </Card>
      ) : null}

      <SectionCard title="习惯信息">
        <TextField label="名称" value={habitName} onChangeText={setHabitName} placeholder="习惯名称" />
        <TextField label="描述" value={description} onChangeText={setDescription} placeholder="描述" />
      </SectionCard>

      <SectionCard title="每日行动">
        {dailyActions.map((item, index) => {
          const tint = PHASE_TINTS[index % PHASE_TINTS.length];
          return (
            <View key={item.day} style={{ flexDirection: "row", gap: spacing.sm }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.md,
                  backgroundColor: colors[tint.bg],
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 2
                }}
              >
                <AppText variant="bodyStrong" style={{ color: colors[tint.fg] }}>
                  {item.day}
                </AppText>
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  value={item.action}
                  onChangeText={(value) => updateAction(item.day, value)}
                  placeholder={`第 ${item.day} 天的小行动`}
                />
              </View>
            </View>
          );
        })}
      </SectionCard>

      <SectionCard title="提醒与记录">
        <TimePickerField label="提醒时间" value={reminderTime || "21:30"} onChange={setReminderTime} />
        <View style={{ gap: spacing.sm }}>
          <Label>记录方式</Label>
          <SegmentedControl<HabitTrackType>
            value={trackType}
            onChange={setTrackType}
            options={[
              { label: "一键完成", value: "check" },
              { label: "数值记录", value: "numeric" }
            ]}
          />
        </View>
        {trackType === "numeric" ? (
          <TextField label="单位" value={numericUnit} onChangeText={setNumericUnit} placeholder="例如：分钟、页、次" />
        ) : null}
      </SectionCard>

      <SectionCard title="降低难度建议">
        <TextField
          value={fallbackAdvice}
          onChangeText={setFallbackAdvice}
          placeholder="卡住时可以怎么调轻"
          multiline
        />
      </SectionCard>

      {error ? <HelperText tone="danger">{error}</HelperText> : null}

      <View style={{ gap: spacing.sm }}>
        <AppButton title="保存计划" onPress={savePlan} disabled={!canSave} />
        <AppButton title="取消" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
