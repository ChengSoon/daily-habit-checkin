import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { getAdjustmentSuggestion } from "../../src/ai/adjustmentRules";
import { listCheckInsForHabit } from "../../src/checkins/checkinRepository";
import { calculateCurrentStreak, calculateLongestStreak, calculateMonthlyCompletionRate } from "../../src/checkins/stats";
import { CheckIn } from "../../src/checkins/types";
import { deleteHabit, getHabitById, setHabitPaused, updateHabit } from "../../src/habits/habitRepository";
import { shouldRunOnDate } from "../../src/habits/habitRules";
import { Habit, HabitFrequency, HabitTrackType } from "../../src/habits/types";
import { scheduleHabitReminder } from "../../src/reminders/reminderService";
import { Screen } from "../../src/ui/Screen";
import { eachDateKey, startOfMonthKey, todayKey } from "../../src/utils/date";

function parseFrequency(value: string): HabitFrequency {
  if (value === "weekdays") {
    return { type: "weekdays" };
  }

  return { type: "daily" };
}

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequencyType, setFrequencyType] = useState<"daily" | "weekdays">("daily");
  const [reminderTime, setReminderTime] = useState("");
  const [trackType, setTrackType] = useState<HabitTrackType>("check");
  const [numericUnit, setNumericUnit] = useState("");
  const [message, setMessage] = useState<string | null>(null);

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
      setFrequencyType(loadedHabit.frequency.type === "weekdays" ? "weekdays" : "daily");
      setReminderTime(loadedHabit.reminderTime ?? "");
      setTrackType(loadedHabit.trackType);
      setNumericUnit(loadedHabit.numericUnit ?? "");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!habit) {
    return (
      <Screen>
        <Text>加载中...</Text>
      </Screen>
    );
  }

  async function save() {
    if (!habit) {
      return;
    }

    await updateHabit(habit.id, {
      name,
      description: description || null,
      frequency: parseFrequency(frequencyType),
      reminderTime: reminderTime || null,
      isReminderEnabled: Boolean(reminderTime),
      trackType,
      numericUnit: trackType === "numeric" ? numericUnit || "次" : null
    });

    const nextHabit = await getHabitById(habit.id);
    if (nextHabit) {
      await scheduleHabitReminder(nextHabit);
    }

    setMessage("已保存");
    await load();
  }

  async function togglePaused() {
    if (!habit) {
      return;
    }

    await setHabitPaused(habit.id, !habit.isPaused);
    await load();
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
      await load();
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
  const monthStartDate = startOfMonthKey(today);
  const monthDates = eachDateKey(habitStartDate > monthStartDate ? habitStartDate : monthStartDate, today);
  const scheduledDates = monthDates.filter((date) => {
    return shouldRunOnDate(habit.frequency, new Date(`${date}T00:00:00`));
  });
  const currentStreak = calculateCurrentStreak({ today, scheduledDates, checkIns });
  const longestStreak = calculateLongestStreak({ scheduledDates, checkIns });
  const completionRate = calculateMonthlyCompletionRate({ scheduledDates, checkIns });
  const completedDates = new Set(checkIns.filter((checkIn) => checkIn.status === "completed").map((checkIn) => checkIn.date));
  const suggestion = getAdjustmentSuggestion({
    completionRate7Days: completionRate,
    currentStreak,
    planEnded: false
  });

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: "800" }}>{habit.name}</Text>
      <Text>{habit.isPaused ? "已暂停" : "进行中"}</Text>
      <Text>当前连续：{currentStreak} 天</Text>
      <Text>最长连续：{longestStreak} 天</Text>
      <Text>本月完成率：{completionRate}%</Text>
      <Text>提醒时间：{habit.reminderTime ?? "未设置"}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {scheduledDates.map((date) => (
          <Text key={date} style={{ padding: 6, borderRadius: 6, backgroundColor: completedDates.has(date) ? "#DDEFD2" : "#EFEDE7" }}>
            {date.slice(5)}
          </Text>
        ))}
      </View>
      {suggestion ? (
        <View style={{ gap: 8, padding: 12, borderRadius: 8, backgroundColor: "#FFFFFF" }}>
          <Text>{suggestion.title}</Text>
          <Text>{suggestion.body}</Text>
          <Button title={suggestion.actionLabel} onPress={applySuggestion} />
        </View>
      ) : null}
      <View style={{ gap: 8, padding: 12, borderRadius: 8, backgroundColor: "#FFFFFF" }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>编辑习惯</Text>
        <TextInput value={name} onChangeText={setName} placeholder="习惯名称" style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }} />
        <TextInput value={description} onChangeText={setDescription} placeholder="描述" style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }} />
        <Text>频率</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button title="每天" onPress={() => setFrequencyType("daily")} color={frequencyType === "daily" ? "#2F6B4F" : undefined} />
          <Button title="工作日" onPress={() => setFrequencyType("weekdays")} color={frequencyType === "weekdays" ? "#2F6B4F" : undefined} />
        </View>
        <TextInput value={reminderTime} onChangeText={setReminderTime} placeholder="提醒时间 21:30" style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }} />
        <Text>记录方式</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button title="一键完成" onPress={() => setTrackType("check")} color={trackType === "check" ? "#2F6B4F" : undefined} />
          <Button title="数值记录" onPress={() => setTrackType("numeric")} color={trackType === "numeric" ? "#2F6B4F" : undefined} />
        </View>
        {trackType === "numeric" ? (
          <TextInput value={numericUnit} onChangeText={setNumericUnit} placeholder="单位，例如 分钟、页、次" style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }} />
        ) : null}
        {message ? <Text>{message}</Text> : null}
        <Button title="保存修改" onPress={save} disabled={!name} />
      </View>
      <Button title={habit.isPaused ? "恢复习惯" : "暂停习惯"} onPress={togglePaused} />
      <Button title="删除习惯" onPress={remove} color="#B3261E" />
    </Screen>
  );
}
