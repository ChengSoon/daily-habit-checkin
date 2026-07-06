import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { getAdjustmentSuggestion } from "../../src/ai/adjustmentRules";
import { getPlanForHabit } from "../../src/ai/habitPlanRepository";
import { HabitPlan } from "../../src/ai/types";
import { listCheckInsForHabit } from "../../src/checkins/checkinRepository";
import { calculateCurrentStreak, calculateLongestStreak, calculateMonthlyCompletionRate } from "../../src/checkins/stats";
import { CheckIn } from "../../src/checkins/types";
import { deleteHabit, getHabitById, setHabitPaused, updateHabit } from "../../src/habits/habitRepository";
import { shouldRunOnDate } from "../../src/habits/habitRules";
import { Habit, HabitFrequency, HabitTrackType } from "../../src/habits/types";
import { scheduleHabitReminder } from "../../src/reminders/reminderService";
import {
  AppButton,
  AppText,
  Badge,
  Card,
  HelperText,
  Label,
  SectionCard,
  SegmentedControl,
  StatTile,
  TextField,
  WeekdayPicker
} from "../../src/ui/Controls";
import { CalendarLegend, MonthCalendar } from "../../src/ui/MonthCalendar";
import { EmptyState } from "../../src/ui/EmptyState";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { spacing } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeContext";
import { eachDateKey, startOfMonthKey, todayKey } from "../../src/utils/date";

type FrequencyType = "daily" | "weekdays" | "weekly";

function parseFrequency(value: FrequencyType, weeklyDays: number[]): HabitFrequency {
  if (value === "weekdays") {
    return { type: "weekdays" };
  }
  if (value === "weekly") {
    return { type: "weekly", daysOfWeek: [...weeklyDays].sort((a, b) => a - b) };
  }
  return { type: "daily" };
}

export default function HabitDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [plan, setPlan] = useState<HabitPlan | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequencyType, setFrequencyType] = useState<FrequencyType>("daily");
  const [weeklyDays, setWeeklyDays] = useState<number[]>([1, 3, 5]);
  const [reminderTime, setReminderTime] = useState("");
  const [trackType, setTrackType] = useState<HabitTrackType>("check");
  const [numericUnit, setNumericUnit] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [manualRequested, setManualRequested] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      return;
    }

    const loadedHabit = await getHabitById(id);
    const loadedCheckIns = await listCheckInsForHabit(id);
    const loadedPlan = await getPlanForHabit(id);

    setHabit(loadedHabit);
    setCheckIns(loadedCheckIns);
    setPlan(loadedPlan);

    if (loadedHabit) {
      setName(loadedHabit.name);
      setDescription(loadedHabit.description ?? "");
      setFrequencyType(loadedHabit.frequency.type);
      if (loadedHabit.frequency.type === "weekly") {
        setWeeklyDays(loadedHabit.frequency.daysOfWeek);
      }
      setReminderTime(loadedHabit.reminderTime ?? "");
      setTrackType(loadedHabit.trackType);
      setNumericUnit(loadedHabit.numericUnit ?? "");
    }
  }, [id]);

  const { status, errorMessage, reload } = useSyncScreen(load);

  if (status !== "ready" || !habit) {
    if (status === "ready") {
      // 已登录且加载成功，但该习惯不存在（可能已被删除）
      return (
        <Screen>
          <EmptyState icon="search-outline" title="习惯不存在" body="这个习惯可能已经被删除了。" />
          <AppButton title="返回" variant="secondary" onPress={() => router.back()} />
        </Screen>
      );
    }
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }

  async function save() {
    if (!habit) {
      return;
    }

    await updateHabit(habit.id, {
      name,
      description: description || null,
      frequency: parseFrequency(frequencyType, weeklyDays),
      reminderTime: reminderTime || null,
      isReminderEnabled: Boolean(reminderTime),
      trackType,
      numericUnit: trackType === "numeric" ? numericUnit || "次" : null
    });

    const nextHabit = await getHabitById(habit.id);
    if (nextHabit) {
      await scheduleHabitReminder(nextHabit);
    }

    setMessage("已保存修改");
    await reload();
  }

  async function togglePaused() {
    if (!habit) {
      return;
    }

    await setHabitPaused(habit.id, !habit.isPaused);
    await reload();
  }

  async function remove() {
    if (!habit) {
      return;
    }

    await deleteHabit(habit.id);
    router.replace("/(tabs)/habits");
  }

  async function applySuggestion() {
    if (!habit || !suggestion) {
      return;
    }

    if (suggestion.actionLabel === "调整计划") {
      const nextDescription = habit.description
        ? `${habit.description}（已根据完成情况调轻：先缩短任务，降低启动压力）`
        : "已根据完成情况调轻：先缩短任务，降低启动压力";

      await updateHabit(habit.id, {
        name: habit.name,
        description: nextDescription,
        frequency: habit.frequency,
        reminderTime: habit.reminderTime,
        isReminderEnabled: habit.isReminderEnabled,
        trackType: habit.trackType,
        numericUnit: habit.numericUnit
      });
      setMessage("已应用调整建议");
      await reload();
      return;
    }

    if (suggestion.actionLabel === "生成下一阶段") {
      router.push("/habit/new");
      return;
    }

    setMessage("已确认保持当前节奏");
  }

  const today = todayKey();
  const habitStartDate = habit.createdAt.slice(0, 10);
  const isScheduled = (date: string) => shouldRunOnDate(habit.frequency, new Date(`${date}T00:00:00`));

  // 连续天数与最长连续：用完整历史，避免跨月被截断
  const allScheduledDates = eachDateKey(habitStartDate, today).filter(isScheduled);
  const currentStreak = calculateCurrentStreak({ today, scheduledDates: allScheduledDates, checkIns });
  const longestStreak = calculateLongestStreak({ scheduledDates: allScheduledDates, checkIns });

  // 本月完成率与月历：只看本月
  const monthStartDate = startOfMonthKey(today);
  const monthScheduledDates = eachDateKey(
    habitStartDate > monthStartDate ? habitStartDate : monthStartDate,
    today
  ).filter(isScheduled);
  const completionRate = calculateMonthlyCompletionRate({ scheduledDates: monthScheduledDates, checkIns });

  // AI 建议依据最近 7 个应执行日的完成率
  const recent7ScheduledDates = allScheduledDates.slice(-7);
  const completionRate7Days = calculateMonthlyCompletionRate({ scheduledDates: recent7ScheduledDates, checkIns });

  const scheduledDates = monthScheduledDates;
  const completedDates = new Set(checkIns.filter((checkIn) => checkIn.status === "completed").map((checkIn) => checkIn.date));
  const planEnded = plan ? today > plan.endDate : false;
  const suggestion = getAdjustmentSuggestion({
    completionRate7Days,
    currentStreak,
    planEnded,
    manualRequested
  });

  return (
    <Screen>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="title">{habit.name}</AppText>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Badge label={habit.isPaused ? "已暂停" : "进行中"} tone={habit.isPaused ? "muted" : "success"} />
          <Badge label={habit.reminderTime ? `提醒 ${habit.reminderTime}` : "无提醒"} tone="neutral" />
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <StatTile label="当前连续" value={`${currentStreak} 天`} />
        <StatTile label="最长连续" value={`${longestStreak} 天`} />
        <StatTile label="本月完成率" value={`${completionRate}%`} />
      </View>

      <SectionCard title="本月记录">
        {scheduledDates.length === 0 ? (
          <AppText variant="small" tone="muted">
            本月还没有应执行的日期。
          </AppText>
        ) : (
          <>
            <MonthCalendar
              monthDateKey={today}
              scheduledDates={new Set(scheduledDates)}
              completedDates={completedDates}
              today={today}
              startDate={habitStartDate}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.xs }}>
              <CalendarLegend color={colors.primary} label="已完成" filled />
              <CalendarLegend color={colors.primary} label="今天" />
              <CalendarLegend color={colors.surfaceMuted} label="未完成" filled />
            </View>
          </>
        )}
      </SectionCard>

      {suggestion ? (
        <Card tone="tint">
          <AppText variant="caption" tone="primary">
            AI 调整建议
          </AppText>
          <AppText variant="bodyStrong">{suggestion.title}</AppText>
          <AppText variant="body" tone="soft">
            {suggestion.body}
          </AppText>
          <AppButton title={suggestion.actionLabel} variant="secondary" onPress={applySuggestion} />
        </Card>
      ) : (
        <AppButton title="调整计划" variant="secondary" onPress={() => setManualRequested(true)} />
      )}

      <SectionCard title="编辑习惯">
        <TextField label="名称" value={name} onChangeText={setName} placeholder="习惯名称" />
        <TextField label="描述" value={description} onChangeText={setDescription} placeholder="描述" />
        <View style={{ gap: spacing.sm }}>
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
        <TextField label="提醒时间" value={reminderTime} onChangeText={setReminderTime} placeholder="21:30" />
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
        {message ? <HelperText tone="success">{message}</HelperText> : null}
        <AppButton
          title="保存修改"
          onPress={save}
          disabled={!name || (frequencyType === "weekly" && weeklyDays.length === 0)}
        />
      </SectionCard>

      <View style={{ gap: spacing.sm }}>
        <AppButton
          title={habit.isPaused ? "恢复习惯" : "暂停习惯"}
          variant="secondary"
          onPress={togglePaused}
        />
        <AppButton title="删除习惯" variant="danger" onPress={remove} />
      </View>
    </Screen>
  );
}
