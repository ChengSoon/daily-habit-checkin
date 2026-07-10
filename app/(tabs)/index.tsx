import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AwardAdventureInput,
  awardAdventureForCheckIn,
  revokeAdventureForCheckIn
} from "../../src/adventure/adventureClient";
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
import { AppButton, AppText, Card, HelperText, TextField } from "../../src/ui/Controls";
import { CheckInCelebration, FullCelebration, MiniCheckInBurst } from "../../src/ui/CheckInCelebration";
import { EmptyState } from "../../src/ui/EmptyState";
import { HabitCompleter, HabitRow } from "../../src/ui/HabitRow";
import { ProgressHeader } from "../../src/ui/ProgressHeader";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { useCouple } from "../../src/ui/useCouple";
import { radius, spacing } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeContext";
import { eachDateKey, todayKey } from "../../src/utils/date";
import { getWallet } from "../../src/xp/xpRepository";
import { awardXpForCheckIn, revokeXpForCheckIn } from "../../src/xp/xpService";
import { XpAwardResult } from "../../src/xp/types";

type PendingAdventureSync = {
  kind: "award" | "revoke";
  input: AwardAdventureInput;
  failureMessage: string;
};

function syncAdventure(request: PendingAdventureSync) {
  return request.kind === "award"
    ? awardAdventureForCheckIn(request.input)
    : revokeAdventureForCheckIn(request.input);
}

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
  const [lastXpResult, setLastXpResult] = useState<XpAwardResult | null>(null);
  const [adventureSyncWarning, setAdventureSyncWarning] = useState<string | null>(null);
  const [pendingAdventureSync, setPendingAdventureSync] = useState<PendingAdventureSync | null>(null);
  const [isRetryingAdventure, setIsRetryingAdventure] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoNow, setUndoNow] = useState(() => new Date());
  const miniBurstKey = useRef(0);
  const today = todayKey();

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

  async function runAdventureSync(request: PendingAdventureSync): Promise<boolean> {
    try {
      await syncAdventure(request);
      setAdventureSyncWarning(null);
      setPendingAdventureSync(null);
      return true;
    } catch {
      setAdventureSyncWarning(request.failureMessage);
      setPendingAdventureSync(request);
      return false;
    }
  }

  async function retryAdventureSync() {
    if (!pendingAdventureSync || isRetryingAdventure) {
      return;
    }
    setIsRetryingAdventure(true);
    try {
      await runAdventureSync(pendingAdventureSync);
    } finally {
      setIsRetryingAdventure(false);
    }
  }

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
    const checkInsByHabit = await Promise.all(loadedHabits.map((habit) => listCheckInsForHabit(habit.id)));
    const loadedCheckIns = checkInsByHabit.flat();
    const todayCheckIns = loadedCheckIns.filter((checkIn) => checkIn.date === today);
    const completedIds = new Set(
      todayCheckIns.filter((checkIn) => checkIn.status === "completed").map((checkIn) => checkIn.habitId)
    );
    const settings = await getAppSettings();
    const incompleteNames = loadedHabits.filter((habit) => !completedIds.has(habit.id)).map((habit) => habit.name);

    const nextStreaks: Record<string, number> = {};
    loadedHabits.forEach((habit, index) => {
      // 连续天数用完整历史，避免跨月在每月 1 号被截断
      const habitStart = habit.createdAt.slice(0, 10);
      const scheduledDates = eachDateKey(habitStart, today).filter((date) =>
        shouldRunOnDate(habit.frequency, new Date(`${date}T00:00:00`))
      );
      nextStreaks[habit.id] = calculateCurrentStreak({ today, scheduledDates, checkIns: checkInsByHabit[index] });
    });

    const wallet = await getWallet();
    setXpBalance(wallet.balance);

    setHabits(loadedHabits);
    setCheckIns(todayCheckIns);
    setStreaks(nextStreaks);
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
    await runAdventureSync({
      kind: "award",
      input: { habitId: habit.id, dateKey: today, checkInId: checkIn.id },
      failureMessage: "打卡已保存，冒险行动力暂未同步。"
    });

    // 用打卡后的完整记录重算连续天数，判断是否命中里程碑
    const habitStart = habit.createdAt.slice(0, 10);
    const scheduledDates = eachDateKey(habitStart, today).filter((date) =>
      shouldRunOnDate(habit.frequency, new Date(`${date}T00:00:00`))
    );
    const habitCheckIns = await listCheckInsForHabit(habit.id);
    const newStreak = calculateCurrentStreak({ today, scheduledDates, checkIns: habitCheckIns });
    const milestone = getStreakMilestone(newStreak);

    setLastXpResult(xpResult);
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
        await runAdventureSync({
          kind: "revoke",
          input: { habitId: habit.id, dateKey: today, checkInId: removed.id },
          failureMessage: "打卡已撤销，冒险行动力暂未同步。"
        });
        setXpBalance(xpResult.wallet.balance);
        setLastXpResult(null);
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

  const lastGain = lastXpResult
    ? lastXpResult.insertedTransactions.reduce((sum, item) => sum + Math.max(item.amount, 0), 0)
    : 0;

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
        />

        <Card
          onPress={() => router.push("/shop")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingVertical: spacing.md
          }}
        >
          <Ionicons name="sparkles" size={16} color={colors.primaryInk} />
          <AppText variant="bodyStrong" tone="primary">
            {xpBalance} 积分
          </AppText>
          <View style={{ flex: 1 }} />
          {lastGain > 0 ? (
            <AppText variant="small" tone="soft">
              本次 +{lastGain}
            </AppText>
          ) : null}
          <Ionicons name="chevron-forward" size={16} color={colors.faint} />
        </Card>

        {adventureSyncWarning ? (
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <HelperText tone="danger">{adventureSyncWarning}</HelperText>
            </View>
            <AppButton
              title="重试"
              compact
              disabled={isRetryingAdventure}
              icon="refresh-outline"
              iconSpin={isRetryingAdventure}
              variant="secondary"
              onPress={() => void retryAdventureSync()}
            />
          </View>
        ) : null}

        {habits.length === 0 ? (
          <>
            <EmptyState title="今天还没有习惯" body="先创建一个想坚持的小习惯，从今天开始。" />
            <AppButton title="新增习惯" onPress={() => router.push("/habit/new")} />
          </>
        ) : (
          <View style={{ gap: spacing.md }}>
            {remaining.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <AppText variant="caption" tone="muted">
                  待完成 {remaining.length}
                </AppText>
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
              <Card tone="tint">
                <AppText variant="bodyStrong" tone="primary">
                  今天全部完成，做得好 🌱
                </AppText>
              </Card>
            )}

            {done.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <AppText variant="caption" tone="muted">
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
