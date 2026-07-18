import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { listHabits, moveHabit } from "../../src/habits/habitRepository";
import { Habit } from "../../src/habits/types";
import { AppButton, AppText, Badge, HelperText, IconButton } from "../../src/ui/Controls";
import { EmptyState } from "../../src/ui/EmptyState";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { radius, shadow, spacing, type Palette } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeContext";

const WEEKDAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"];

// 岛上"角落"的图标 + 糖果色底：结构性图标统一走 Ionicons（对齐 v2 board 线性图标）。
type IoniconName = keyof typeof Ionicons.glyphMap;
const CHIP_PALETTE: { bg: keyof Palette; fg: keyof Palette }[] = [
  { bg: "candySunSurface", fg: "candyOrange" },
  { bg: "candySkySurface", fg: "candySky" },
  { bg: "partnerSurface", fg: "partnerInk" },
  { bg: "successSurface", fg: "success" },
  { bg: "candyOrangeSurface", fg: "candyOrange" },
  { bg: "surfaceTint", fg: "primaryInk" }
];
const ICON_POOL: IoniconName[] = [
  "book-outline",
  "walk-outline",
  "barbell-outline",
  "moon-outline",
  "cafe-outline",
  "musical-notes-outline",
  "leaf-outline",
  "sunny-outline"
];

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

function habitIcon(habit: Habit, index: number): IoniconName {
  if (habit.trackType === "numeric") return "water-outline";
  return ICON_POOL[index % ICON_POOL.length];
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
  const pausedCount = habits.length - activeCount;

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md }}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="display">习惯</AppText>
          <AppText variant="body" tone="muted">
            岛上的日常角落
          </AppText>
        </View>
        <AppButton title="新增" icon="add" compact onPress={() => router.push("/habit/new")} />
      </View>

      {/* Bento 双数据卡 */}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: 1, borderRadius: radius.lg, backgroundColor: colors.surfaceTint, padding: spacing.md, gap: 4, ...shadow.soft }}>
          <AppText variant="small" tone="primary">
            进行中
          </AppText>
          <AppText variant="title" tone="primary" style={{ fontSize: 28, lineHeight: 34 }}>
            {activeCount}
          </AppText>
        </View>
        <View style={{ flex: 1, borderRadius: radius.lg, backgroundColor: colors.partnerSurface, padding: spacing.md, gap: 4, ...shadow.soft }}>
          <AppText variant="small" style={{ color: colors.partnerInk, fontWeight: "700" }}>
            已暂停
          </AppText>
          <AppText variant="title" style={{ color: colors.partnerInk, fontSize: 28, lineHeight: 34 }}>
            {pausedCount}
          </AppText>
        </View>
      </View>

      {/* AI 规划入口 */}
      <View style={{ borderRadius: radius.lg, backgroundColor: colors.partnerSurface, padding: spacing.md, gap: spacing.sm, ...shadow.soft }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={{ width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
            <Ionicons name="sparkles" size={22} color={colors.partnerInk} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">让 AI 规划新角落</AppText>
            <AppText variant="small" tone="muted">
              说出目标，生成可执行的分阶段计划
            </AppText>
          </View>
        </View>
        <AppButton title="生成计划" icon="sparkles" variant="secondary" compact onPress={() => router.push("/habit/new")} />
      </View>

      {activeCount > 7 ? (
        <HelperText tone="muted">
          你有 {activeCount} 个进行中的习惯。建议同时专注 3 到 7 个，太多反而容易顾不过来。
        </HelperText>
      ) : null}

      {habits.length === 0 ? (
        <EmptyState title="还没有习惯" body="用 AI 生成一个入门计划，或者手动创建一个。" />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {habits.map((habit, index) => {
            const pair = CHIP_PALETTE[index % CHIP_PALETTE.length];
            return (
              <Pressable
                key={habit.id}
                accessibilityRole="button"
                accessibilityLabel={`编辑 ${habit.name}`}
                onPress={() => router.push({ pathname: "/habit/[id]", params: { id: habit.id } })}
                style={({ pressed }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    borderRadius: radius.lg,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.line,
                    paddingVertical: 14,
                    paddingHorizontal: spacing.md,
                    ...shadow.soft
                  },
                  pressed ? { opacity: 0.9, transform: [{ scale: 0.99 }] } : null
                ]}
              >
                <View style={{ width: 48, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors[pair.bg] }}>
                  <Ionicons name={habitIcon(habit, index)} size={24} color={colors[pair.fg]} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <AppText variant="bodyStrong" tone={habit.isPaused ? "muted" : "default"} numberOfLines={1} style={{ flex: 1 }}>
                      {habit.name}
                    </AppText>
                    {habit.isPaused ? <Badge label="已暂停" tone="muted" /> : <Badge label="活跃" tone="success" />}
                  </View>
                  <AppText variant="small" tone="faint" numberOfLines={1}>
                    {frequencyLabel(habit)} · {habit.reminderTime ? `提醒 ${habit.reminderTime}` : "无提醒"}
                  </AppText>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <View style={{ borderRadius: 999, backgroundColor: colors.surfaceTint, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <AppText variant="small" tone="primary" style={{ fontWeight: "800" }}>
                        +10 XP
                      </AppText>
                    </View>
                    {habit.trackType === "numeric" ? (
                      <View style={{ borderRadius: 999, backgroundColor: colors.candySkySurface, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <AppText variant="small" style={{ color: colors.candySky, fontWeight: "800" }}>
                          数值
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={{ gap: 4 }}>
                  <IconButton name="chevron-up" accessibilityLabel={`将 ${habit.name} 上移`} onPress={() => move(habit.id, "up")} disabled={index === 0} />
                  <IconButton name="chevron-down" accessibilityLabel={`将 ${habit.name} 下移`} onPress={() => move(habit.id, "down")} disabled={index === habits.length - 1} />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
