import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ReactNode } from "react";
import { View } from "react-native";
import type { CurrentIsland } from "../../adventure/currentIsland";
import { canUndoCheckIn } from "../../checkins/undoWindow";
import type { CheckIn } from "../../checkins/types";
import type { Habit } from "../../habits/types";
import type { CouplePerson } from "../Avatar";
import { AppButton, AppText, Card } from "../Controls";
import type { HabitCompleter } from "../HabitRow";
import { HabitRow } from "../HabitRow";
import { ProgressHeader } from "../ProgressHeader";
import { Screen } from "../Screen";
import { sceneTint } from "../theme";
import { useTheme } from "../ThemeContext";

function parseNumericTarget(habit: Habit): number {
  const match = habit.name.match(/(\d+(?:\.\d+)?)/);
  const value = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(value) && value > 0 ? value : 8;
}

const isDualHabit = (habit: Habit) => /一起|双人|情侣|共同/.test(habit.name);

export type TodayDashboardProps = {
  habits: Habit[];
  remaining: Habit[];
  done: Habit[];
  completedCount: number;
  streaks: Record<string, number>;
  todayCheckIns: Record<string, CheckIn>;
  completers: Record<string, HabitCompleter>;
  people: CouplePerson[];
  hasPartner: boolean;
  island: CurrentIsland | null;
  xpBalance: number;
  xpAccessory?: ReactNode;
  weekDoneKeys: string[];
  undoNow: Date;
  isUndoing: boolean;
  onStartComplete: (habit: Habit) => void;
  onCelebrate: (habitName: string) => void;
  onUndo: (habit: Habit, checkIn: CheckIn) => void;
};

function EmptyToday() {
  const { colors, scheme } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <Card {...sceneTint("coral", scheme)} elevated={false} style={{ alignItems: "center", paddingVertical: 20, paddingHorizontal: 13, gap: 8 }}>
        <AppText variant="section" style={{ textAlign: "center" }}>岛上还没有角落</AppText>
        <AppText variant="body" tone="muted" style={{ textAlign: "center", marginTop: 4 }}>
          先新增一个习惯，或点右上角 ✨ 用 AI 对话生成计划
        </AppText>
        <View style={{ width: "100%", gap: 8, marginTop: 12 }}>
          <AppButton title="新增习惯" icon="add" onPress={() => router.push("/habit/new")} />
        </View>
      </Card>
      <Card {...sceneTint("sun", scheme)} elevated={false} style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
        <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.candySunSurface, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="bulb-outline" size={18} color={colors.candyOrange} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong" style={{ fontSize: 15 }}>小贴士</AppText>
          <AppText variant="small" tone="muted">从每天 5 分钟的小事开始，比一口气立很多目标更容易坚持。</AppText>
        </View>
      </Card>
    </View>
  );
}

function RemainingHabits(props: Pick<TodayDashboardProps, "remaining" | "streaks" | "onStartComplete" | "onCelebrate">) {
  const { remaining, streaks, onStartComplete, onCelebrate } = props;
  const { colors, scheme } = useTheme();
  if (remaining.length === 0) return (
    <Card {...sceneTint("mint", scheme)} elevated={false} style={{ alignItems: "center", gap: 8, paddingVertical: 16, paddingHorizontal: 13 }}>
      <AppText variant="section" style={{ color: colors.success, textAlign: "center" }}>今日印章已点亮</AppText>
      <AppText variant="body" tone="muted" style={{ textAlign: "center" }}>小岛又繁荣了一点，去商城兑换小心意吧</AppText>
      <AppButton title="去商城" icon="gift-outline" onPress={() => router.push("/shop")} style={{ alignSelf: "stretch", marginTop: 4 }} />
    </Card>
  );
  return <View style={{ gap: 8 }}>{remaining.map((habit) => <HabitRow
    key={habit.id}
    habit={habit}
    isCompleted={false}
    streak={streaks[habit.id]}
    xpLabel="+10"
    dualLabel={isDualHabit(habit)}
    numericValue={habit.trackType === "numeric" ? 0 : null}
    numericTarget={habit.trackType === "numeric" ? parseNumericTarget(habit) : null}
    onComplete={() => onStartComplete(habit)}
    onCelebrate={() => onCelebrate(habit.name)}
    onOpen={() => router.push({ pathname: "/habit/[id]", params: { id: habit.id } })}
  />)}</View>;
}

function DoneHabitRow({ habit, props }: { habit: Habit; props: TodayDashboardProps }) {
  const checkIn = props.todayCheckIns[habit.id];
  return <HabitRow
    habit={habit}
    isCompleted
    streak={props.streaks[habit.id]}
    xpLabel="+10"
    completedBy={props.completers[habit.id]}
    dualLabel={isDualHabit(habit)}
    numericValue={habit.trackType === "numeric" && checkIn?.value != null ? checkIn.value : null}
    numericTarget={habit.trackType === "numeric" ? parseNumericTarget(habit) : null}
    canUndo={checkIn ? canUndoCheckIn(checkIn, props.undoNow) : false}
    isUndoing={props.isUndoing}
    onComplete={() => undefined}
    onUndo={() => checkIn && props.onUndo(habit, checkIn)}
    onOpen={() => router.push({ pathname: "/habit/[id]", params: { id: habit.id } })}
  />;
}

function TodayTasks(props: TodayDashboardProps) {
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][new Date().getDay()];
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 }}>
      <AppText variant="section">今日待办</AppText>
      <AppText variant="small" tone="muted">
        {props.remaining.length > 0 ? `再完成 ${props.remaining.length} 项解锁印章` : `今天 · ${weekday}`}
      </AppText>
    </View>
    <RemainingHabits {...props} />
    {props.done.length > 0 ? <View style={{ gap: 8 }}>
      <AppText variant="small" tone="muted">已完成 {props.done.length}</AppText>
      {props.done.map((habit) => <DoneHabitRow key={habit.id} habit={habit} props={props} />)}
    </View> : null}
  </View>;
}

export function TodayDashboard(props: TodayDashboardProps) {
  const { habits, completedCount, people, hasPartner, island, streaks, xpBalance, weekDoneKeys, xpAccessory } = props;
  return (
    <Screen>
      <ProgressHeader
        completed={completedCount}
        total={habits.length}
        people={people}
        hasPartner={hasPartner}
        islandKey={island?.key}
        islandImageKey={island?.nodeImageKey}
        islandName={island?.name}
        islandLevel={island?.level}
        streakDays={Math.max(0, ...Object.values(streaks), 0)}
        xpBalance={xpBalance}
        onPressXp={() => router.push("/shop")}
        onPressAi={() => router.push("/(tabs)/ai")}
        doneDateKeys={weekDoneKeys}
        xpAccessory={xpAccessory}
      />
      {habits.length === 0 ? <EmptyToday /> : <TodayTasks {...props} />}
    </Screen>
  );
}
