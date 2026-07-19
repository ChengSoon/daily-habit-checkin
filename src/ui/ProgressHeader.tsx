import { ReactNode } from "react";
import { View } from "react-native";
import { CoupleAvatars, CouplePerson } from "./Avatar";
import { AppText } from "./Controls";
import { IslandHero } from "./IslandHero";
import { WeekStrip } from "./WeekStrip";

function greetingForHour(hour: number): string {
  if (hour < 5) return "夜深了";
  if (hour < 11) return "早安";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  if (hour < 22) return "晚上好";
  return "夜深了";
}

const WEEKDAY_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

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
  showWeekStrip = false,
  islandKey,
  islandImageKey,
  islandName = "我们的小岛",
  islandLevel
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
  /** 共同小岛主题 key（跟随世界地图到达的岛，由今日页从闯关进度传入）。 */
  islandKey?: string | null;
  islandImageKey?: string | null;
  islandName?: string;
  islandLevel?: number;
}) {
  const now = new Date();
  const greeting = greetingForHour(now.getHours());
  const ratio = total === 0 ? 0 : completed / total;
  const allDone = total > 0 && completed === total;

  const caption =
    total === 0
      ? "创建第一个习惯，开始经营你们的小岛"
      : allDone
        ? hasPartner
          ? "今天你们都点亮了印章 · 繁荣拉满"
          : "今日印章已点亮 · 繁荣拉满"
        : completed === 0
          ? hasPartner
            ? "今天还没浇灌，一起开始吧"
            : "今天还没浇灌，点亮第一项吧"
          : hasPartner
            ? `今天你们一起浇灌了 ${completed} 次 · 繁荣 +${completed * 4}`
            : `今天已浇灌 ${completed} 次 · 繁荣 +${completed * 4}`;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ gap: 4, flex: 1, paddingRight: 8 }}>
          <AppText
            variant="caption"
            tone="muted"
            style={{ textTransform: "none", letterSpacing: 0.8, fontWeight: "800" }}
          >
            {greeting} · {WEEKDAY_ZH[now.getDay()]}
          </AppText>
          <AppText variant="title" style={{ fontSize: 22, lineHeight: 28 }}>
            {hasPartner ? "一起打卡 ✨" : "今日打卡 ✨"}
          </AppText>
        </View>
        {people.length > 0 ? <CoupleAvatars people={people} size={34} showRibbon={false} /> : null}
      </View>

      <IslandHero
        variant="today"
        islandKey={islandKey}
        islandImageKey={islandImageKey}
        islandName={islandName}
        islandLevel={islandLevel}
        ratio={ratio}
        detail={caption}
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
