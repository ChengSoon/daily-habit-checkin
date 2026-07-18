import { ReactNode } from "react";
import { View } from "react-native";
import { CoupleAvatars, CouplePerson } from "./Avatar";
import { AppText } from "./Controls";
import { IslandHero } from "./IslandHero";
import { spacing } from "./theme";
import { WeekStrip } from "./WeekStrip";

function greetingForHour(hour: number): string {
  if (hour < 5) return "夜深了";
  if (hour < 11) return "早安";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  if (hour < 22) return "晚上好";
  return "夜深了";
}

/**
 * 今日头部：问候行 + 共同岛屿卡（IslandHero）+ 本周周历。
 * 岛屿卡是 v2 招牌——打卡即"浇灌"这片你俩共同经营的小岛。
 */
export function ProgressHeader({
  completed,
  total,
  people = [],
  hasPartner = false,
  streakDays,
  xpBalance,
  xpAccessory,
  onPressXp,
  doneDateKeys,
  showWeekStrip = true,
  islandKey = "lighthouse",
  islandName = "灯塔湾"
}: {
  completed: number;
  total: number;
  people?: CouplePerson[];
  hasPartner?: boolean;
  streakDays?: number;
  xpBalance?: number;
  /** 积分旁附加动画（如 +N） */
  xpAccessory?: ReactNode;
  onPressXp?: () => void;
  /** 本周已有完成打卡的日期，用于周历点亮 */
  doneDateKeys?: Set<string> | string[];
  showWeekStrip?: boolean;
  /** 共同小岛主题 key（默认灯塔湾主岛）。 */
  islandKey?: string;
  islandName?: string;
}) {
  const now = new Date();
  const greeting = greetingForHour(now.getHours());
  const ratio = total === 0 ? 0 : completed / total;
  const remaining = Math.max(total - completed, 0);
  const allDone = total > 0 && completed === total;

  const caption =
    total === 0
      ? "创建第一个习惯，开始经营你们的小岛"
      : allDone
        ? hasPartner
          ? "今天你们都点亮了印章 ✨"
          : "今日印章已点亮 ✨"
        : `今天一起浇灌 ${completed} 次 · 还差 ${remaining} 项`;

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ gap: 4, flex: 1, paddingRight: spacing.sm }}>
          <AppText variant="caption" tone="muted" style={{ textTransform: "none", letterSpacing: 0.2 }}>
            {greeting}
          </AppText>
          <AppText variant="title" style={{ fontSize: 28, lineHeight: 34 }}>
            {hasPartner ? "一起打卡 ✨" : "今日打卡 ✨"}
          </AppText>
        </View>
        {people.length > 0 ? <CoupleAvatars people={people} size={40} showRibbon={false} /> : null}
      </View>

      <IslandHero
        variant="today"
        islandKey={islandKey}
        islandName={islandName}
        ratio={ratio}
        caption={caption}
        people={people}
        streakDays={streakDays}
        xpBalance={xpBalance}
        xpAccessory={xpAccessory}
        onPressXp={onPressXp}
      />

      {showWeekStrip ? <WeekStrip doneDateKeys={doneDateKeys} /> : null}
    </View>
  );
}
