import { router } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { listHabits, moveHabit } from "../../src/habits/habitRepository";
import { Habit } from "../../src/habits/types";
import { AppButton, AppText, Badge, HelperText, IconButton } from "../../src/ui/Controls";
import { EmptyState } from "../../src/ui/EmptyState";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { spacing } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeContext";

const WEEKDAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"];

function frequencyLabel(habit: Habit): string {
  if (habit.frequency.type === "daily") {
    return "每天";
  }
  if (habit.frequency.type === "weekdays") {
    return "工作日";
  }
  const days = [...habit.frequency.daysOfWeek].sort((a, b) => a - b);
  if (days.length === 0) {
    return "每周";
  }
  return `每周 ${days.map((day) => WEEKDAY_SHORT[day]).join("")}`;
}

export default function HabitsScreen() {
  const { colors } = useTheme();
  const [habits, setHabits] = useState<Habit[]>([]);

  const load = useCallback(async () => {
    setHabits(await listHabits());
  }, []);

  const { status, errorMessage, reload } = useSyncScreen(load);

  async function move(id: string, direction: "up" | "down") {
    await moveHabit(id, direction);
    reload();
  }

  const activeCount = habits.filter((habit) => !habit.isPaused).length;

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="display">习惯</AppText>
        <AppText variant="body" tone="muted">
          管理你的所有习惯
        </AppText>
      </View>

      <AppButton title="新增习惯" icon="add" onPress={() => router.push("/habit/new")} />

      {activeCount > 7 ? (
        <HelperText tone="muted">
          你有 {activeCount} 个进行中的习惯。建议同时专注 3 到 7 个，太多反而容易顾不过来。
        </HelperText>
      ) : null}

      {habits.length === 0 ? (
        <EmptyState title="还没有习惯" body="用 AI 生成一个入门计划，或者手动创建一个。" />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {habits.map((habit, index) => (
            <View
              key={habit.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: habit.isPaused ? colors.surfaceMuted : colors.surface,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.md
              }}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <AppText variant="bodyStrong" tone={habit.isPaused ? "muted" : "default"} numberOfLines={1}>
                    {habit.name}
                  </AppText>
                  {habit.isPaused ? <Badge label="已暂停" tone="muted" /> : null}
                </View>
                <AppText variant="small" tone="faint" numberOfLines={1}>
                  {frequencyLabel(habit)} · {habit.reminderTime ? `提醒 ${habit.reminderTime}` : "无提醒"}
                </AppText>
              </View>
              <View style={{ flexDirection: "row", gap: spacing.xs }}>
                <IconButton
                  name="chevron-up"
                  accessibilityLabel={`将 ${habit.name} 上移`}
                  onPress={() => move(habit.id, "up")}
                  disabled={index === 0}
                />
                <IconButton
                  name="chevron-down"
                  accessibilityLabel={`将 ${habit.name} 下移`}
                  onPress={() => move(habit.id, "down")}
                  disabled={index === habits.length - 1}
                />
                <IconButton
                  name="create-outline"
                  tone="primary"
                  accessibilityLabel={`编辑 ${habit.name}`}
                  onPress={() => router.push({ pathname: "/habit/[id]", params: { id: habit.id } })}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
