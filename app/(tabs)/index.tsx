import { router } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { completeCheckIn, listCheckInsForHabit } from "../../src/checkins/checkinRepository";
import { CheckIn } from "../../src/checkins/types";
import { calculateCurrentStreak } from "../../src/checkins/stats";
import { listActiveHabits } from "../../src/habits/habitRepository";
import { shouldRunOnDate } from "../../src/habits/habitRules";
import { Habit } from "../../src/habits/types";
import { rescheduleHabitReminders, rescheduleTodayEveningSummary } from "../../src/reminders/reminderService";
import { getAppSettings } from "../../src/settings/settingsRepository";
import { AppButton, AppText, Card, TextField } from "../../src/ui/Controls";
import { CheckInCelebration } from "../../src/ui/CheckInCelebration";
import { EmptyState } from "../../src/ui/EmptyState";
import { HabitRow } from "../../src/ui/HabitRow";
import { ProgressHeader } from "../../src/ui/ProgressHeader";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { useCouple } from "../../src/ui/useCouple";
import { spacing } from "../../src/ui/theme";
import { eachDateKey, todayKey } from "../../src/utils/date";
import { getWallet } from "../../src/xp/xpRepository";
import { awardXpForCheckIn } from "../../src/xp/xpService";
import { XpAwardResult } from "../../src/xp/types";

export default function TodayScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [numericHabit, setNumericHabit] = useState<Habit | null>(null);
  const [numericValue, setNumericValue] = useState("");
  const [celebrationHabitName, setCelebrationHabitName] = useState<string | null>(null);
  const [xpBalance, setXpBalance] = useState(0);
  const [lastXpResult, setLastXpResult] = useState<XpAwardResult | null>(null);
  const today = todayKey();

  const showCelebration = useCallback((habitName: string) => {
    setCelebrationHabitName(habitName);
  }, []);

  const hideCelebration = useCallback(() => {
    setCelebrationHabitName(null);
  }, []);

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
      habits: loadedHabits,
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

  async function complete(habit: Habit, value: number | null, shouldCelebrate = false) {
    if (shouldCelebrate) {
      showCelebration(habit.name);
    }

    const checkIn = await completeCheckIn({ habitId: habit.id, date: today, value, note: null });
    const xpResult = await awardXpForCheckIn({ habitId: habit.id, dateKey: today, checkInId: checkIn.id });

    setLastXpResult(xpResult);
    setXpBalance(xpResult.wallet.balance);
    setNumericHabit(null);
    setNumericValue("");
    await reload();
  }

  function startComplete(habit: Habit) {
    if (habit.trackType === "numeric") {
      setNumericHabit(habit);
      setNumericValue("");
      return;
    }
    complete(habit, null);
  }

  const completedIds = new Set(
    checkIns.filter((checkIn) => checkIn.status === "completed").map((checkIn) => checkIn.habitId)
  );
  const remaining = habits.filter((habit) => !completedIds.has(habit.id));
  const done = habits.filter((habit) => completedIds.has(habit.id));

  // 已完成项标注是谁打的卡：checkIn.createdBy → couple 里的人。
  const completerByHabit: Record<string, { name: string; tone: "you" | "partner" }> = {};
  for (const checkIn of checkIns) {
    if (checkIn.status !== "completed" || !checkIn.createdBy) {
      continue;
    }
    const person = couple.byId[checkIn.createdBy];
    if (person) {
      completerByHabit[checkIn.habitId] = { name: person.name, tone: person.tone };
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
          people={couple.people.map((person) => ({ name: person.name, tone: person.tone }))}
          hasPartner={couple.partner !== null}
        />

        <Card tone="tint" onPress={() => router.push("/shop")}>
          <AppText variant="caption" tone="primary">
            积分余额
          </AppText>
          <AppText variant="title" tone="primary">
            {xpBalance} 积分
          </AppText>
          {lastXpResult && lastXpResult.insertedTransactions.length > 0 ? (
            <AppText variant="small" tone="soft">
              本次 +{lastXpResult.insertedTransactions.reduce((sum, item) => sum + Math.max(item.amount, 0), 0)} 积分 ·{" "}
              {lastXpResult.awards
                .filter((award) => lastXpResult.insertedTransactions.some((item) => item.reason === award.reason))
                .map((award) => award.label)
                .join(" / ")}
            </AppText>
          ) : null}
        </Card>

        {numericHabit ? (
          <Card tone="tint">
            <AppText variant="bodyStrong">
              {numericHabit.name}：完成了多少{numericHabit.numericUnit ?? ""}？
            </AppText>
            <TextField value={numericValue} onChangeText={setNumericValue} keyboardType="numeric" placeholder="输入数值" />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <AppButton title="取消" variant="ghost" onPress={() => setNumericHabit(null)} style={{ flex: 1 }} />
              <AppButton
                title="确认打卡"
                onPress={() => complete(numericHabit, Number(numericValue), true)}
                disabled={!numericValue}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
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
                    onCelebrate={() => showCelebration(habit.name)}
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
                {done.map((habit) => (
                  <HabitRow
                    key={habit.id}
                    habit={habit}
                    isCompleted
                    streak={streaks[habit.id]}
                    onComplete={() => undefined}
                    onOpen={() => router.push({ pathname: "/habit/[id]", params: { id: habit.id } })}
                  />
                ))}
              </View>
            ) : null}
          </View>
        )}
      </Screen>
      <CheckInCelebration
        visible={celebrationHabitName !== null}
        habitName={celebrationHabitName ?? undefined}
        onFinish={hideCelebration}
      />
    </>
  );
}
