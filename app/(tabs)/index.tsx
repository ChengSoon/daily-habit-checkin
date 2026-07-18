import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { completeCheckIn, listCheckInsForHabit, undoCheckIn } from "../../src/checkins/checkinRepository";
import { CheckIn } from "../../src/checkins/types";
import { getStreakMilestone } from "../../src/checkins/milestones";
import { calculateCurrentStreak } from "../../src/checkins/stats";
import { canUndoCheckIn, CHECKIN_UNDO_WINDOW_MS } from "../../src/checkins/undoWindow";
import { listActiveHabits } from "../../src/habits/habitRepository";
import { shouldRunOnDate } from "../../src/habits/habitRules";
import { Habit } from "../../src/habits/types";
import { rescheduleHabitReminders, rescheduleTodayEveningSummary } from "../../src/reminders/reminderService";
import { getAppSettings } from "../../src/settings/settingsRepository";
import { AppButton, AppText, Card, TextField } from "../../src/ui/Controls";
import { CheckInCelebration, FullCelebration, MiniCheckInBurst } from "../../src/ui/CheckInCelebration";
import { HabitCompleter, HabitRow } from "../../src/ui/HabitRow";
import { ProgressHeader } from "../../src/ui/ProgressHeader";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { useCouple } from "../../src/ui/useCouple";
import { radius, spacing } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeContext";
import { eachDateKey, todayKey } from "../../src/utils/date";
import { buildCurrentWeekDays } from "../../src/utils/week";
import { getWallet } from "../../src/xp/xpRepository";
import { awardXpForCheckIn, revokeXpForCheckIn } from "../../src/xp/xpService";
import { XpGainLabel } from "../../src/ui/XpGainLabel";

export default function TodayScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [numericHabit, setNumericHabit] = useState<Habit | null>(null);
  const [numericValue, setNumericValue] = useState("");
  const [miniBurst, setMiniBurst] = useState<{ key: number; habitName: string } | null>(null);
  const [fullCelebration, setFullCelebration] = useState<FullCelebration | null>(null);
  const [xpBalance, setXpBalance] = useState(0);
  const [xpGain, setXpGain] = useState<{ amount: number; key: number } | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoNow, setUndoNow] = useState(() => new Date());
  const [weekDoneKeys, setWeekDoneKeys] = useState<string[]>([]);
  const miniBurstKey = useRef(0);
  const xpGainKey = useRef(0);
  const today = todayKey();

  const clearXpGain = useCallback(() => {
    setXpGain(null);
  }, []);

  const showMiniBurst = useCallback((habitName: string) => {
    miniBurstKey.current += 1;
    setMiniBurst({ key: miniBurstKey.current, habitName });
  }, []);

  const hideMiniBurst = useCallback(() => {
    setMiniBurst(null);
  }, []);

  const hideFullCelebration = useCallback(() => {
    setFullCelebration(null);
  }, []);

  useEffect(() => {
    const undoableCheckIns = checkIns.filter((checkIn) => checkIn.status === "completed" && canUndoCheckIn(checkIn, undoNow));
    if (undoableCheckIns.length === 0) {
      return;
    }

    const nextExpiresAt = Math.min(
      ...undoableCheckIns.map((checkIn) => new Date(checkIn.createdAt).getTime() + CHECKIN_UNDO_WINDOW_MS)
    );
    const delay = Math.max(0, nextExpiresAt - Date.now() + 1);
    const timer = setTimeout(() => {
      setUndoNow(new Date());
    }, delay);

    return () => clearTimeout(timer);
  }, [checkIns, undoNow]);

  const load = useCallback(async () => {
    const activeHabits = await listActiveHabits();
    const loadedHabits = activeHabits.filter((habit) => shouldRunOnDate(habit.frequency, new Date(`${today}T00:00:00`)));
    // 拉取全部活跃习惯历史：今日列表 + 周历点亮共用，避免重复请求
    const checkInsByHabit = await Promise.all(activeHabits.map((habit) => listCheckInsForHabit(habit.id)));
    const checkInsByHabitId = new Map(activeHabits.map((habit, index) => [habit.id, checkInsByHabit[index]]));
    const todayCheckIns = checkInsByHabit
      .flat()
      .filter((checkIn) => checkIn.date === today && loadedHabits.some((habit) => habit.id === checkIn.habitId));
    const completedIds = new Set(
      todayCheckIns.filter((checkIn) => checkIn.status === "completed").map((checkIn) => checkIn.habitId)
    );
    const settings = await getAppSettings();
    const incompleteNames = loadedHabits.filter((habit) => !completedIds.has(habit.id)).map((habit) => habit.name);

    const nextStreaks: Record<string, number> = {};
    for (const habit of loadedHabits) {
      // 连续天数用完整历史，避免跨月在每月 1 号被截断
      const habitStart = habit.createdAt.slice(0, 10);
      const scheduledDates = eachDateKey(habitStart, today).filter((date) =>
        shouldRunOnDate(habit.frequency, new Date(`${date}T00:00:00`))
      );
      nextStreaks[habit.id] = calculateCurrentStreak({
        today,
        scheduledDates,
        checkIns: checkInsByHabitId.get(habit.id) ?? []
      });
    }

    // 本周全勤日：当天有应做习惯且全部 completed 则点亮
    const weekDone: string[] = [];
    for (const day of buildCurrentWeekDays()) {
      if (day.dateKey >= today) {
        continue;
      }
      const scheduled = activeHabits.filter((habit) =>
        !habit.isPaused && shouldRunOnDate(habit.frequency, new Date(`${day.dateKey}T00:00:00`))
      );
      if (scheduled.length === 0) {
        continue;
      }
      const allDone = scheduled.every((habit) =>
        (checkInsByHabitId.get(habit.id) ?? []).some(
          (checkIn) => checkIn.date === day.dateKey && checkIn.status === "completed"
        )
      );
      if (allDone) {
        weekDone.push(day.dateKey);
      }
    }

    const wallet = await getWallet();
    setXpBalance(wallet.balance);

    setHabits(loadedHabits);
    setCheckIns(todayCheckIns);
    setStreaks(nextStreaks);
    setWeekDoneKeys(weekDone);
    await rescheduleHabitReminders({
      habits: activeHabits,
      completedHabitIds: completedIds,
      quietHours: {
        isEnabled: settings.isQuietHoursEnabled,
        start: settings.quietHoursStart,
        end: settings.quietHoursEnd
      }
    });
    await rescheduleTodayEveningSummary({
      isEnabled: settings.isEveningSummaryEnabled,
      incompleteNames,
      time: settings.eveningSummaryTime
    });
  }, [today]);

  const { status, errorMessage, reload } = useSyncScreen(load);
  const couple = useCouple();

  const completedIds = new Set(
    checkIns.filter((checkIn) => checkIn.status === "completed").map((checkIn) => checkIn.habitId)
  );
  const remaining = habits.filter((habit) => !completedIds.has(habit.id));
  const done = habits.filter((habit) => completedIds.has(habit.id));

  async function complete(habit: Habit, value: number | null, fromNumeric = false) {
    // 数值型此刻才真正完成，轻量庆祝在确认时补上（勾选型在按下瞬间已由 onCelebrate 触发）
    if (fromNumeric) {
      showMiniBurst(habit.name);
    }

    // 在数据刷新前记住：这次打卡是否清空了今天的待办
    const wasLastRemaining = remaining.length === 1 && remaining[0].id === habit.id;

    const checkIn = await completeCheckIn({ habitId: habit.id, date: today, value, note: null });
    const xpResult = await awardXpForCheckIn({ habitId: habit.id, dateKey: today, checkInId: checkIn.id });

    // 用打卡后的完整记录重算连续天数，判断是否命中里程碑
    const habitStart = habit.createdAt.slice(0, 10);
    const scheduledDates = eachDateKey(habitStart, today).filter((date) =>
      shouldRunOnDate(habit.frequency, new Date(`${date}T00:00:00`))
    );
    const habitCheckIns = await listCheckInsForHabit(habit.id);
    const newStreak = calculateCurrentStreak({ today, scheduledDates, checkIns: habitCheckIns });
    const milestone = getStreakMilestone(newStreak);

    const gainedFromTx = xpResult.insertedTransactions.reduce(
      (sum, item) => sum + Math.max(item.amount, 0),
      0
    );
    // 兜底：若交易列表空但余额已涨（时序/幂等边界），仍用余额差展示 +N
    const gainedFromBalance = Math.max(0, xpResult.wallet.balance - xpBalance);
    const gained = gainedFromTx > 0 ? gainedFromTx : gainedFromBalance;
    if (gained > 0) {
      xpGainKey.current += 1;
      setXpGain({ amount: gained, key: xpGainKey.current });
    } else {
      setXpGain(null);
    }
    setXpBalance(xpResult.wallet.balance);
    setNumericHabit(null);
    setNumericValue("");
    await reload();
    setUndoNow(new Date());

    // 全屏仪式感只留给里程碑和今日全勤；里程碑更稀有，优先展示
    if (milestone !== null) {
      setFullCelebration({ kind: "milestone", days: milestone, habitName: habit.name });
    } else if (wasLastRemaining) {
      setFullCelebration({ kind: "allDone" });
    }
  }

  function startComplete(habit: Habit) {
    if (habit.trackType === "numeric") {
      setNumericHabit(habit);
      setNumericValue("");
      return;
    }
    complete(habit, null);
  }

  async function undoTodayCheckIn(habit: Habit, checkIn: CheckIn) {
    if (isUndoing || !canUndoCheckIn(checkIn, new Date())) {
      return;
    }

    setIsUndoing(true);
    setFullCelebration(null);

    try {
      const removed = await undoCheckIn({ habitId: habit.id, date: today, checkInId: checkIn.id });
      if (removed) {
        const xpResult = await revokeXpForCheckIn({
          habitId: habit.id,
          dateKey: today,
          checkInId: removed.id
        });
        setXpBalance(xpResult.wallet.balance);
        setXpGain(null);
      }
      await reload();
      setUndoNow(new Date());
    } finally {
      setIsUndoing(false);
    }
  }

  function cancelNumeric() {
    setNumericHabit(null);
    setNumericValue("");
  }

  // 已完成项标注是谁打的卡：checkIn.createdBy → couple 里的人（含自定义头像）。
  const completerByHabit: Record<string, HabitCompleter> = {};
  const todayCheckInByHabit: Record<string, CheckIn> = {};
  for (const checkIn of checkIns) {
    if (checkIn.status === "completed") {
      todayCheckInByHabit[checkIn.habitId] = checkIn;
    }
    if (checkIn.status !== "completed" || !checkIn.createdBy) {
      continue;
    }
    const person = couple.byId[checkIn.createdBy];
    if (person) {
      completerByHabit[checkIn.habitId] = {
        name: person.name,
        tone: person.tone,
        imageUri: person.avatarUrl
      };
    }
  }

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }

  return (
    <>
      <Screen>
        <ProgressHeader
          completed={completedIds.size}
          total={habits.length}
          people={couple.people.map((person) => ({
            name: person.name,
            tone: person.tone,
            imageUri: person.avatarUrl
          }))}
          hasPartner={couple.partner !== null}
          streakDays={Math.max(0, ...Object.values(streaks), 0)}
          xpBalance={xpBalance}
          onPressXp={() => router.push("/shop")}
          doneDateKeys={weekDoneKeys}
          xpAccessory={
            xpGain ? (
              <XpGainLabel amount={xpGain.amount} playKey={xpGain.key} onFinish={clearXpGain} />
            ) : null
          }
        />

        {habits.length === 0 ? (
          <View style={{ gap: spacing.md }}>
            <Card
              style={{
                alignItems: "center",
                paddingVertical: spacing.xl,
                backgroundColor: colors.surfaceTint,
                borderColor: colors.line
              }}
            >
              <AppText style={{ fontSize: 40, lineHeight: 48, marginBottom: spacing.sm }}>🌱</AppText>
              <AppText variant="section" style={{ textAlign: "center" }}>
                今天还没有习惯
              </AppText>
              <AppText variant="small" tone="muted" style={{ textAlign: "center", marginTop: spacing.xs }}>
                先创建一个想坚持的小习惯，从今天开始。
              </AppText>
              <View style={{ width: "100%", gap: spacing.sm, marginTop: spacing.lg }}>
                <AppButton title="＋ 新增习惯" onPress={() => router.push("/habit/new")} />
                <AppButton title="✨ AI 帮我规划" variant="secondary" onPress={() => router.push("/habit/new")} />
              </View>
            </Card>
            <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: colors.candySunSurface,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <AppText style={{ fontSize: 18 }}>💡</AppText>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong">小贴士</AppText>
                <AppText variant="small" tone="muted">
                  从每天 5 分钟的小事开始，比一口气立 10 个 flag 更容易坚持。
                </AppText>
              </View>
            </Card>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <AppText variant="section">今日待办</AppText>
              <AppText variant="small" tone="muted">
                {remaining.length > 0
                  ? `再完成 ${remaining.length} 项解锁印章`
                  : `今天 · ${["日", "一", "二", "三", "四", "五", "六"][new Date().getDay()]}`}
              </AppText>
            </View>

            {remaining.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                {remaining.map((habit) => (
                  <HabitRow
                    key={habit.id}
                    habit={habit}
                    isCompleted={false}
                    streak={streaks[habit.id]}
                    onComplete={() => startComplete(habit)}
                    onCelebrate={() => showMiniBurst(habit.name)}
                    onOpen={() => router.push({ pathname: "/habit/[id]", params: { id: habit.id } })}
                  />
                ))}
              </View>
            ) : (
              <Card
                style={{
                  backgroundColor: colors.successSurface,
                  borderColor: colors.successSurface,
                  alignItems: "center",
                  gap: spacing.sm,
                  paddingVertical: spacing.lg
                }}
              >
                <AppText style={{ fontSize: 36, lineHeight: 42 }}>🎉</AppText>
                <AppText variant="bodyStrong" style={{ color: colors.success, textAlign: "center" }}>
                  今天全部完成，做得好 🌱
                </AppText>
                <AppText variant="small" tone="muted" style={{ textAlign: "center" }}>
                  印章已点亮，去商城看看想兑换什么吧
                </AppText>
                <AppButton
                  title="🎁 去商城逛逛"
                  onPress={() => router.push("/shop")}
                  style={{ alignSelf: "stretch", marginTop: spacing.xs }}
                />
              </Card>
            )}

            {done.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <AppText variant="small" tone="muted">
                  已完成 {done.length}
                </AppText>
                {done.map((habit) => {
                  const checkIn = todayCheckInByHabit[habit.id];
                  const canUndo = checkIn ? canUndoCheckIn(checkIn, undoNow) : false;
                  return (
                    <HabitRow
                      key={habit.id}
                      habit={habit}
                      isCompleted
                      streak={streaks[habit.id]}
                      completedBy={completerByHabit[habit.id]}
                      canUndo={canUndo}
                      isUndoing={isUndoing}
                      onComplete={() => undefined}
                      onUndo={() => checkIn && undoTodayCheckIn(habit, checkIn)}
                      onOpen={() => router.push({ pathname: "/habit/[id]", params: { id: habit.id } })}
                    />
                  );
                })}
              </View>
            ) : null}
          </View>
        )}
      </Screen>

      <Modal visible={numericHabit !== null} transparent animationType="slide" onRequestClose={cancelNumeric}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <Pressable
            accessibilityLabel="关闭输入"
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
            onPress={cancelNumeric}
          />
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.lg,
              paddingBottom: spacing.lg + insets.bottom,
              gap: spacing.md
            }}
          >
            <View style={{ gap: spacing.xs }}>
              <AppText variant="section">{numericHabit?.name}</AppText>
              <AppText variant="small" tone="muted">
                完成了多少{numericHabit?.numericUnit ?? ""}？
              </AppText>
            </View>
            <TextField
              value={numericValue}
              onChangeText={setNumericValue}
              keyboardType="numeric"
              placeholder="输入数值"
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <AppButton title="取消" variant="ghost" onPress={cancelNumeric} style={{ flex: 1 }} />
              <AppButton
                title="确认打卡"
                onPress={() => numericHabit && complete(numericHabit, Number(numericValue), true)}
                disabled={!numericValue || Number.isNaN(Number(numericValue))}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <MiniCheckInBurst trigger={miniBurst} onFinish={hideMiniBurst} />
      <CheckInCelebration celebration={fullCelebration} onFinish={hideFullCelebration} />
    </>
  );
}
