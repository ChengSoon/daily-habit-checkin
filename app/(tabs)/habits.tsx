import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { listCheckInsForHabit } from "../../src/checkins/checkinRepository";
import { listHabits } from "../../src/habits/habitRepository";
import { shouldRunOnDate } from "../../src/habits/habitRules";
import { buildCurrentWeekDays } from "../../src/utils/week";
import { todayKey } from "../../src/utils/date";
import { Habit } from "../../src/habits/types";
import { AppButton, AppText, Badge, HelperText } from "../../src/ui/Controls";
import { EmptyState } from "../../src/ui/EmptyState";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { numberLetterSpacing, shadow, type Palette } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeContext";

const WEEKDAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"];

// 岛上"角落"的图标 + 糖果色底：结构性图标统一走 Ionicons（对齐 v2 board 线性图标）。
type IoniconName = keyof typeof Ionicons.glyphMap;
const CHIP_PALETTE: { bg: keyof Palette; fg: keyof Palette }[] = [
  { bg: "candySunSurface", fg: "candySunInk" },
  { bg: "candySkySurface", fg: "candySkyInk" },
  { bg: "partnerSurface", fg: "partnerInk" },
  { bg: "successSurface", fg: "candyMintInk" },
  { bg: "candyOrangeSurface", fg: "candyOrangeInk" },
  { bg: "surfaceTint", fg: "primaryInk" }
];
const ICON_POOL: IoniconName[] = [
  "book-outline",
  "water-outline",
  "pulse-outline",
  "walk-outline",
  "moon-outline",
  "cafe-outline",
  "leaf-outline",
  "sunny-outline"
];
// board 02 装饰性「岛上角落」名（纯展示，不进业务数据）
const CORNER_NAMES = ["灯塔书房", "森林泉眼", "环岛跑道", "营地小径", "云桥茶亭", "山顶邮局", "港湾甲板", "珊瑚礁"];

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
  const { colors, scheme } = useTheme();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [weekRate, setWeekRate] = useState(0);

  const load = useCallback(async () => {
    const all = await listHabits();
    setHabits(all);
    // 本周完成率：本周已过应执行日中，完成数 / 应执行数
    const today = todayKey();
    const weekDays = buildCurrentWeekDays().filter((d) => d.dateKey <= today);
    let scheduled = 0;
    let completed = 0;
    const active = all.filter((h) => !h.isPaused);
    const checkInsByHabit = await Promise.all(active.map((h) => listCheckInsForHabit(h.id)));
    for (let i = 0; i < active.length; i += 1) {
      const habit = active[i];
      const checks = checkInsByHabit[i];
      for (const day of weekDays) {
        if (!shouldRunOnDate(habit.frequency, new Date(`${day.dateKey}T00:00:00`))) continue;
        scheduled += 1;
        if (checks.some((c) => c.date === day.dateKey && c.status === "completed")) {
          completed += 1;
        }
      }
    }
    setWeekRate(scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100));
  }, []);

  const { status, errorMessage, reload } = useSyncScreen(load);


  const activeCount = habits.filter((habit) => !habit.isPaused).length;

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="display">习惯</AppText>
          <AppText variant="body" tone="muted">
            岛上的日常角落
          </AppText>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            onPress={() => router.push("/(tabs)/ai")}
            hitSlop={6}
            accessibilityLabel="AI 助手"
            style={{
              width: 38,
              height: 38,
              borderRadius: 13,
              backgroundColor: colors.partnerSurface,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Ionicons name="sparkles" size={18} color={colors.partnerInk} />
          </Pressable>
          <AppButton title="新增" icon="add" compact onPress={() => router.push("/habit/new")} />
        </View>
      </View>

      {/* Bento 双数据卡 */}
      <View style={{ flexDirection: "row", gap: 9 }}>
        <View style={{ flex: 1, borderRadius: 15, backgroundColor: colors.surfaceTint, paddingHorizontal: 12, paddingVertical: 11, gap: 4 }}>
          <AppText variant="small" tone="primary" style={{ fontWeight: "800", fontSize: 12, lineHeight: 16 }}>
            进行中
          </AppText>
          <AppText variant="title" tone="primary" style={{ fontSize: 26, lineHeight: 32, letterSpacing: numberLetterSpacing, fontFamily: "Outfit_800ExtraBold" }}>
            {activeCount}
          </AppText>
        </View>
        <View style={{ flex: 1, borderRadius: 15, backgroundColor: colors.partnerSurface, paddingHorizontal: 12, paddingVertical: 11, gap: 4 }}>
          <AppText variant="small" style={{ color: colors.partnerInk, fontWeight: "800", fontSize: 12, lineHeight: 16 }}>
            本周完成率
          </AppText>
          <AppText variant="title" style={{ color: colors.partnerInk, fontSize: 26, lineHeight: 32, letterSpacing: numberLetterSpacing, fontFamily: "Outfit_800ExtraBold" }}>
            {weekRate}%
          </AppText>
        </View>
      </View>

      {activeCount > 7 ? (
        <HelperText tone="muted">
          你有 {activeCount} 个进行中的习惯。建议同时专注 3 到 7 个，太多反而容易顾不过来。
        </HelperText>
      ) : null}

      {habits.length === 0 ? (
        <EmptyState fill title="岛上还没有角落" body="先新增一个习惯，或点右上角 ✨ 用 AI 对话生成分阶段计划。" />
      ) : (
        <View style={{ gap: 8 }}>
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
                    gap: 11,
                    borderRadius: 20,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.line,
                    paddingVertical: 13,
                    paddingHorizontal: 13,
                    ...shadow.soft
                  },
                  pressed ? { opacity: 0.9, transform: [{ scale: 0.99 }] } : null
                ]}
              >
                <View style={{ width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors[pair.bg] }}>
                  <Ionicons name={habitIcon(habit, index)} size={24} color={colors[pair.fg]} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <AppText
                      variant="bodyStrong"
                      tone={habit.isPaused ? "muted" : "default"}
                      numberOfLines={1}
                      style={{ flex: 1, fontFamily: "Outfit_700Bold", fontSize: 16 }}
                    >
                      {habit.name}
                    </AppText>
                    {habit.isPaused ? <Badge label="已暂停" tone="muted" /> : <Badge label="活跃" tone="success" />}
                  </View>
                  <AppText variant="small" tone="faint" numberOfLines={1}>
                    {frequencyLabel(habit)}
                    {habit.reminderTime ? ` · ${habit.reminderTime} 提醒` : " · 无提醒"}
                  </AppText>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    <View style={{ borderRadius: 999, backgroundColor: colors.surfaceTint, paddingHorizontal: 9, paddingVertical: 4 }}>
                      <AppText variant="small" tone="primary" style={{ fontWeight: "800", fontSize: 12, lineHeight: 16 }}>
                        +10 XP
                      </AppText>
                    </View>
                    {habit.trackType === "numeric" ? (
                      <View style={{ borderRadius: 999, backgroundColor: colors.candySkySurface, paddingHorizontal: 9, paddingVertical: 4 }}>
                        <AppText variant="small" style={{ color: colors.candySkyInk, fontWeight: "800", fontSize: 12, lineHeight: 16 }}>
                          数值
                        </AppText>
                      </View>
                    ) : habit.frequency.type === "weekdays" ? (
                      <View style={{ borderRadius: 999, backgroundColor: colors.candyOrangeSurface, paddingHorizontal: 9, paddingVertical: 4 }}>
                        <AppText variant="small" style={{ color: colors.candyOrangeInk, fontWeight: "800", fontSize: 12, lineHeight: 16 }}>
                          工作日
                        </AppText>
                      </View>
                    ) : null}
                    <View style={{ borderRadius: 999, backgroundColor: colors[pair.bg], paddingHorizontal: 9, paddingVertical: 4 }}>
                      <AppText variant="small" style={{ color: colors[pair.fg], fontWeight: "800", fontSize: 12, lineHeight: 16 }}>
                        {CORNER_NAMES[index % CORNER_NAMES.length]}
                      </AppText>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
