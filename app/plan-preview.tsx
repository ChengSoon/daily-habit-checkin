import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { saveAIHabitPlan } from "../src/ai/habitPlanRepository";
import { AIPlanDay, AIPlanPreview } from "../src/ai/types";
import { createHabit } from "../src/habits/habitRepository";
import { HabitFrequency, HabitTrackType } from "../src/habits/types";
import { refreshScheduledReminders } from "../src/reminders/reminderService";
import { AnimatedReveal } from "../src/ui/AnimatedReveal";
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
import { numberLetterSpacing, sceneTint, type Palette, type TintName } from "../src/ui/theme";
import { useTheme } from "../src/ui/ThemeContext";
import { todayKey } from "../src/utils/date";

const PHASE_TINTS: { tint: TintName; fg: keyof Palette }[] = [
  { tint: "sky", fg: "candySkyInk" },
  { tint: "lavender", fg: "partnerInk" },
  { tint: "orange", fg: "candyOrangeInk" }
];

const PHASE_META = [
  { label: "低强度", xp: "+20 XP" },
  { label: "中强度", xp: "+30 XP" },
  { label: "进阶", xp: "+40 XP" }
] as const;

/** board 07：把每日行动收成 3 个阶段卡（展示 + 可编辑细节）。 */
function buildPhases(actions: AIPlanDay[], durationDays: number) {
  const sorted = [...actions].sort((a, b) => a.day - b.day);
  if (durationDays >= 21) {
    return [
      { n: 1, title: "适应期 · Day 1–7", range: [1, 7] as const, days: sorted.filter((d) => d.day >= 1 && d.day <= 7) },
      { n: 2, title: "建立期 · Day 8–14", range: [8, 14] as const, days: sorted.filter((d) => d.day >= 8 && d.day <= 14) },
      { n: 3, title: "巩固期 · Day 15–21", range: [15, 21] as const, days: sorted.filter((d) => d.day >= 15) }
    ];
  }
  return [
    { n: 1, title: "启动期 · Day 1–3", range: [1, 3] as const, days: sorted.filter((d) => d.day >= 1 && d.day <= 3) },
    { n: 2, title: "建立期 · Day 4–5", range: [4, 5] as const, days: sorted.filter((d) => d.day >= 4 && d.day <= 5) },
    { n: 3, title: "巩固期 · Day 6–7", range: [6, 7] as const, days: sorted.filter((d) => d.day >= 6) }
  ];
}


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
  const { colors, scheme } = useTheme();
  const [habitName, setHabitName] = useState(plan.habitName);
  const [description, setDescription] = useState(plan.description);
  const [reminderTime, setReminderTime] = useState(plan.recommendedReminderTime);
  const [trackType, setTrackType] = useState<HabitTrackType>(plan.recommendedTrackType);
  const [numericUnit, setNumericUnit] = useState(plan.numericUnit ?? "");
  const [fallbackAdvice, setFallbackAdvice] = useState(plan.fallbackAdvice);
  const [dailyActions, setDailyActions] = useState<AIPlanDay[]>(plan.dailyActions);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);
  const [showImportSettings, setShowImportSettings] = useState(false);

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
          params.weeklyDays
            ? params.weeklyDays.startsWith("[")
              ? (JSON.parse(params.weeklyDays) as number[])
              : params.weeklyDays.split(",").map(Number).filter((n) => Number.isFinite(n))
            : []
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
      <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }} hitSlop={8}>
        <Ionicons name="chevron-back" size={16} color={colors.inkSoft} />
        <AppText variant="small" tone="soft">返回</AppText>
      </Pressable>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="sparkles" size={15} color={colors.partnerInk} />
          <AppText variant="caption" style={{ color: colors.partnerInk, textTransform: "none", letterSpacing: 0.6, fontWeight: "800" }}>
            AI Generated
          </AppText>
        </View>
        <AppText variant="display">{habitName || `${plan.durationDays} 天计划`}</AppText>
        <AppText variant="body" tone="muted">
          根据你们的基础与时间偏好生成，可一键导入为岛上新角落。确认前可自由编辑。
        </AppText>
      </View>

      {plan.safetyNote ? (
        <Card elevated={false} tone="tint">
          <AppText variant="caption" tone="primary">
            安全提示
          </AppText>
          <AppText variant="body" tone="soft">
            {plan.safetyNote}
          </AppText>
        </Card>
      ) : null}

      {/* board 07 三阶段卡 */}
      <View style={{ gap: 10 }}>
        {buildPhases(dailyActions, plan.durationDays).map((phase, index) => {
          const tint = PHASE_TINTS[index % PHASE_TINTS.length];
          const meta = PHASE_META[index % PHASE_META.length];
          const summary =
            phase.days.find((d) => d.action.trim())?.action ||
            `Day ${phase.range[0]}–${phase.range[1]} 的行动安排`;
          return (
            <Card key={phase.n} {...sceneTint(tint.tint, scheme)} elevated={false} style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 13,
                    backgroundColor: colors.surface,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <AppText
                    variant="title"
                    style={{ color: colors[tint.fg], fontSize: 17, lineHeight: 22, letterSpacing: numberLetterSpacing, fontFamily: "Outfit_800ExtraBold" }}
                  >
                    {phase.n}
                  </AppText>
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <AppText variant="bodyStrong" style={{ fontFamily: "Outfit_700Bold", fontSize: 16 }}>
                    {phase.title}
                  </AppText>
                  <AppText variant="body" tone="muted">
                    {summary}
                  </AppText>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    <View style={{ borderRadius: 999, backgroundColor: colors.surface, paddingHorizontal: 9, paddingVertical: 4 }}>
                      <AppText variant="small" style={{ color: colors[tint.fg], fontWeight: "800" }}>
                        {meta.label}
                      </AppText>
                    </View>
                    <View style={{ borderRadius: 999, backgroundColor: colors.surface, paddingHorizontal: 9, paddingVertical: 4 }}>
                      <AppText variant="small" style={{ color: colors.primaryInk, fontWeight: "800" }}>
                        {meta.xp}
                      </AppText>
                    </View>
                  </View>
                </View>
              </View>
              <Pressable
                onPress={() => setExpandedPhase(expandedPhase === phase.n ? null : phase.n)}
                style={{ alignSelf: "flex-start" }}
                hitSlop={6}
              >
                <AppText variant="small" style={{ color: colors[tint.fg], fontWeight: "800" }}>
                  {expandedPhase === phase.n ? "收起每日细节" : "编辑每日细节"}
                </AppText>
              </Pressable>
              {expandedPhase === phase.n ? (
                <AnimatedReveal variant="inline" style={{ gap: 8, marginTop: 2 }}>
                  {phase.days.map((item) => (
                    <TextField
                      key={item.day}
                      label={`Day ${item.day}`}
                      value={item.action}
                      onChangeText={(value) => updateAction(item.day, value)}
                      placeholder={`第 ${item.day} 天的小行动`}
                    />
                  ))}
                </AnimatedReveal>
              ) : null}
            </Card>
          );
        })}
      </View>

      <AppButton
        title={showImportSettings ? "收起导入设置" : "调整导入设置"}
        variant="ghost"
        onPress={() => setShowImportSettings((v) => !v)}
      />
      {showImportSettings ? (
        <AnimatedReveal>
        <SectionCard title="习惯信息">
          <TextField label="名称" value={habitName} onChangeText={setHabitName} placeholder="习惯名称" />
          <TextField label="描述" value={description} onChangeText={setDescription} placeholder="描述" />
          <TimePickerField label="提醒时间" value={reminderTime || "21:30"} onChange={setReminderTime} />
          <View style={{ gap: 8 }}>
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
            <AnimatedReveal variant="inline">
            <TextField label="单位" value={numericUnit} onChangeText={setNumericUnit} placeholder="例如：分钟、页、次" />
            </AnimatedReveal>
          ) : null}
          <TextField
            label="降低难度建议"
            value={fallbackAdvice}
            onChangeText={setFallbackAdvice}
            placeholder="卡住时可以怎么调轻"
            multiline
          />
        </SectionCard>
        </AnimatedReveal>
      ) : null}

      {error ? <HelperText tone="danger">{error}</HelperText> : null}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <AppButton title="重新生成" variant="secondary" icon="refresh-outline" onPress={() => router.back()} style={{ flex: 1 }} />
        <AppButton title="导入习惯" icon="download-outline" onPress={savePlan} disabled={!canSave} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}
