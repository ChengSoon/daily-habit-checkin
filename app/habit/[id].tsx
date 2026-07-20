import { AnimatedReveal } from "../../src/ui/AnimatedReveal";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { listCheckInsForHabit } from "../../src/checkins/checkinRepository";
import { calculateCurrentStreak } from "../../src/checkins/stats";
import { CheckIn } from "../../src/checkins/types";
import { deleteHabit, getHabitById, setHabitPaused, updateHabit } from "../../src/habits/habitRepository";
import { shouldRunOnDate } from "../../src/habits/habitRules";
import { Habit, HabitFrequency, HabitTrackType } from "../../src/habits/types";
import { refreshScheduledReminders } from "../../src/reminders/reminderService";
import {
  AppButton,
  AppText,
  Card,
  HelperText,
  Label,
  SectionCard,
  SegmentedControl,
  StatTile,
  TextField,
  WeekdayPicker
} from "../../src/ui/Controls";
import { MonthCalendar } from "../../src/ui/MonthCalendar";
import { EmptyState } from "../../src/ui/EmptyState";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { sceneTint } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeContext";
import { eachDateKey, startOfMonthKey, todayKey } from "../../src/utils/date";
import { normalizeTimeInput } from "../../src/utils/time";

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
  const { colors, scheme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequencyType, setFrequencyType] = useState<FrequencyType>("daily");
  const [weeklyDays, setWeeklyDays] = useState<number[]>([1, 3, 5]);
  const [reminderTime, setReminderTime] = useState("");
  const [trackType, setTrackType] = useState<HabitTrackType>("check");
  const [numericUnit, setNumericUnit] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      return;
    }

    const loadedHabit = await getHabitById(id);
    const loadedCheckIns = await listCheckInsForHabit(id);
    setHabit(loadedHabit);
    setCheckIns(loadedCheckIns);
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
          <EmptyState icon="search-outline" title="找不到这个角落" body="它可能已被删除，回习惯列表看看其他角落吧。" />
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

    // 提醒时间为空表示不提醒；非空则必须是合法的 24 小时制时间
    const trimmedReminder = reminderTime.trim();
    let normalizedReminder: string | null = null;
    if (trimmedReminder) {
      normalizedReminder = normalizeTimeInput(trimmedReminder);
      if (!normalizedReminder) {
        setTimeError("提醒时间格式不正确，请用 24 小时制，例如 21:30");
        setMessage(null);
        return;
      }
    }
    setTimeError(null);

    await updateHabit(habit.id, {
      name,
      description: description || null,
      frequency: parseFrequency(frequencyType, weeklyDays),
      reminderTime: normalizedReminder,
      isReminderEnabled: Boolean(normalizedReminder),
      trackType,
      numericUnit: trackType === "numeric" ? numericUnit || "次" : null
    });
    setReminderTime(normalizedReminder ?? "");

    await refreshScheduledReminders();
    setMessage("已保存修改");
    await reload();
  }

  async function togglePaused() {
    if (!habit) {
      return;
    }

    await setHabitPaused(habit.id, !habit.isPaused);
    await refreshScheduledReminders();
    await reload();
  }

  async function remove() {
    if (!habit) {
      return;
    }

    await deleteHabit(habit.id);
    await refreshScheduledReminders();
    router.replace("/(tabs)/habits");
  }


  const today = todayKey();
  const habitStartDate = habit.createdAt.slice(0, 10);
  const isScheduled = (date: string) => shouldRunOnDate(habit.frequency, new Date(`${date}T00:00:00`));

  // 连续天数与最长连续：用完整历史，避免跨月被截断
  const allScheduledDates = eachDateKey(habitStartDate, today).filter(isScheduled);
  const currentStreak = calculateCurrentStreak({ today, scheduledDates: allScheduledDates, checkIns });

  // 本月完成率与月历：只看本月
  const monthStartDate = startOfMonthKey(today);
  const monthScheduledDates = eachDateKey(
    habitStartDate > monthStartDate ? habitStartDate : monthStartDate,
    today
  ).filter(isScheduled);
  const scheduledDates = monthScheduledDates;
  const completedDates = new Set(checkIns.filter((checkIn) => checkIn.status === "completed").map((checkIn) => checkIn.date));
  const nextMilestone = [7, 14, 30, 60, 100, 200].find((m) => m > currentStreak) ?? currentStreak + 50;

  function timePeriodLabel(time: string): string {
    const hour = Number(time.slice(0, 2));
    if (!Number.isFinite(hour)) return "";
    if (hour < 5) return "凌晨";
    if (hour < 11) return "早";
    if (hour < 14) return "中午";
    if (hour < 18) return "下午";
    return "晚";
  }

  function frequencyText(): string {
    if (!habit) return "";
    if (habit.frequency.type === "daily") return "每天";
    if (habit.frequency.type === "weekdays") return "工作日";
    const days = [...(habit.frequency.type === "weekly" ? habit.frequency.daysOfWeek : [])].sort((a, b) => a - b);
    const names = ["日", "一", "二", "三", "四", "五", "六"];
    return days.length ? `每周 ${days.map((d) => names[d]).join("")}` : "每周";
  }
  const monthDone = monthScheduledDates.filter((d) => completedDates.has(d)).length;
  const monthTitle = `${Number(today.slice(5, 7))}月`;

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
        <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4 }} hitSlop={8}>
          <Ionicons name="chevron-back" size={16} color={colors.inkSoft} />
          <AppText variant="small" tone="soft">
            返回
          </AppText>
        </Pressable>
        <Pressable onPress={() => setEditMode((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }} hitSlop={8}>
          <Ionicons name={editMode ? "checkmark" : "create-outline"} size={16} color={colors.inkSoft} />
          <AppText variant="small" tone="soft">
            {editMode ? "完成" : "编辑"}
          </AppText>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 11, padding: 13 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 15,
            backgroundColor: colors.candySunSurface,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Ionicons name={habit.trackType === "numeric" ? "water-outline" : "book-outline"} size={22} color={colors.candySunInk} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="title">{habit.name}</AppText>
          <AppText variant="body" tone="muted">
            {frequencyText()}
            {habit.reminderTime ? ` · ${timePeriodLabel(habit.reminderTime)} ${habit.reminderTime}` : ""}
            {" · +10 XP"}
          </AppText>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 9 }}>
        <StatTile
          label="当前连续"
          value={`${currentStreak} 天`}
          tint={colors.surfaceTint}
          labelColor={colors.primaryInk}
          valueColor={colors.primaryInk}
        />
        <StatTile
          label="本月完成"
          value={String(monthDone)}
          tint={colors.partnerSurface}
          labelColor={colors.partnerInk}
          valueColor={colors.partnerInk}
        />
      </View>

      <Card elevated={false} style={{ gap: 10, padding: 13 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText variant="section">{monthTitle}</AppText>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <View style={{ borderRadius: 999, backgroundColor: colors.successSurface, paddingHorizontal: 9, paddingVertical: 4 }}>
              <AppText variant="small" style={{ color: colors.candyMintInk, fontWeight: "800", fontSize: 12, lineHeight: 16 }}>
                你
              </AppText>
            </View>
            <View style={{ borderRadius: 999, backgroundColor: colors.partnerSurface, paddingHorizontal: 9, paddingVertical: 4 }}>
              <AppText variant="small" style={{ color: colors.partnerInk, fontWeight: "800", fontSize: 12, lineHeight: 16 }}>
                双人
              </AppText>
            </View>
          </View>
        </View>
        {scheduledDates.length === 0 ? (
          <AppText variant="small" tone="muted">
            本月还没有应执行的日期。
          </AppText>
        ) : (
          <MonthCalendar
            monthDateKey={today}
            scheduledDates={new Set(scheduledDates)}
            completedDates={completedDates}
            today={today}
            startDate={habitStartDate}
          />
        )}
      </Card>

      <Card {...sceneTint("mint", scheme)} elevated={false} style={{ flexDirection: "row", alignItems: "center", gap: 11, padding: 13 }}>
        <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="medal-outline" size={16} color={colors.candyMintInk} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" style={{ color: colors.candyMintInk, textTransform: "none", letterSpacing: 0 }}>
            下一步里程碑
          </AppText>
          <AppText variant="bodyStrong">
            连续 {nextMilestone} 天 · 再坚持 {Math.max(1, nextMilestone - currentStreak)} 天
          </AppText>
        </View>
      </Card>

      {editMode ? (
        <>
          <SectionCard title="编辑习惯">
            <TextField label="名称" value={name} onChangeText={setName} placeholder="习惯名称" />
            <TextField label="描述" value={description} onChangeText={setDescription} placeholder="描述" />
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
              {frequencyType === "weekly" ? <WeekdayPicker value={weeklyDays} onChange={setWeeklyDays} /> : null}
            </View>
            <TextField label="提醒时间" value={reminderTime} onChangeText={setReminderTime} placeholder="21:30" />
            {timeError ? <HelperText tone="danger">{timeError}</HelperText> : null}
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
            {message ? <HelperText tone="success">{message}</HelperText> : null}
            <AppButton
              title="保存修改"
              onPress={save}
              disabled={!name || (frequencyType === "weekly" && weeklyDays.length === 0)}
            />
          </SectionCard>
          <View style={{ gap: 8 }}>
            <AppButton title={habit.isPaused ? "恢复习惯" : "暂停习惯"} variant="secondary" onPress={togglePaused} />
            {isConfirmingDelete ? (
              <Card elevated={false} tone="muted">
                <AppText variant="bodyStrong" tone="danger">
                  确定删除「{habit.name}」？
                </AppText>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <AppButton title="取消" variant="ghost" onPress={() => setIsConfirmingDelete(false)} style={{ flex: 1 }} />
                  <AppButton title="确认删除" variant="danger" onPress={remove} style={{ flex: 1 }} />
                </View>
              </Card>
            ) : (
              <AppButton title="删除习惯" variant="danger" onPress={() => setIsConfirmingDelete(true)} />
            )}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
