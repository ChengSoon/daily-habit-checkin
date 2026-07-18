import { ReactNode } from "react";
import { Pressable, View } from "react-native";
import Svg, { Ellipse, Path } from "react-native-svg";
import { CoupleAvatars, CouplePerson } from "./Avatar";
import { AppText } from "./Controls";
import { ProgressRing } from "./ProgressRing";
import { radius, shadow, spacing } from "./theme";
import { useTheme } from "./ThemeContext";
import { WeekStrip } from "./WeekStrip";

function greetingForHour(hour: number): string {
  if (hour < 5) return "夜深了";
  if (hour < 11) return "Good morning";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  if (hour < 22) return "晚上好";
  return "夜深了";
}

/** Soft 3D 贴纸：小星星 */
function StickerStar({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.5l2.6 6.2 6.7.6-5.1 4.5 1.6 6.5L12 16.8 6.2 20.3l1.6-6.5L2.7 9.3l6.7-.6L12 2.5z"
        fill={color}
      />
    </Svg>
  );
}

/** Soft 3D 贴纸：软云朵 */
function StickerCloud({ color = "#FFFFFF", size = 32 }: { color?: string; size?: number }) {
  const h = Math.round(size * 0.7);
  return (
    <Svg width={size} height={h} viewBox="0 0 40 28" fill="none">
      <Ellipse cx="16" cy="16" rx="12" ry="9" fill={color} />
      <Ellipse cx="26" cy="17" rx="10" ry="8" fill={color} />
      <Ellipse cx="21" cy="12" rx="8" ry="7" fill={color} />
    </Svg>
  );
}

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
  showWeekStrip = true
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
}) {
  const { colors, scheme } = useTheme();
  const now = new Date();
  const greeting = greetingForHour(now.getHours());
  const ratio = total === 0 ? 0 : completed / total;
  const remaining = Math.max(total - completed, 0);
  const allDone = total > 0 && completed === total;

  const progressTitle =
    total === 0 ? "还没有习惯" : allDone ? "今日全勤 ✨" : `${completed} / ${total} 完成`;

  const progressHint =
    total === 0
      ? "创建第一个习惯开始今天"
      : allDone
        ? hasPartner
          ? "你们今天都点亮了印章"
          : "今日印章已点亮"
        : `再完成 ${remaining} 项可解锁今日印章`;

  const isDark = scheme === "dark";

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

      <View
        style={{
          borderRadius: radius.xl,
          padding: spacing.lg,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: isDark ? colors.line : "rgba(255,255,255,0.9)",
          backgroundColor: isDark ? colors.surfaceTint : colors.surfaceTint,
          ...shadow.card
        }}
      >
        {/* 柔光层：亮色主题用多层叠色模拟 soft 3D 卡片 */}
        {!isDark ? (
          <View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}>
            <View
              style={{
                position: "absolute",
                top: -20,
                right: -10,
                width: 140,
                height: 140,
                borderRadius: 999,
                backgroundColor: colors.candySun,
                opacity: 0.22
              }}
            />
            <View
              style={{
                position: "absolute",
                bottom: -30,
                left: -20,
                width: 150,
                height: 150,
                borderRadius: 999,
                backgroundColor: colors.primary,
                opacity: 0.12
              }}
            />
            <View
              style={{
                position: "absolute",
                top: 40,
                left: 40,
                width: 120,
                height: 120,
                borderRadius: 999,
                backgroundColor: colors.partner,
                opacity: 0.08
              }}
            />
          </View>
        ) : null}

        {/* 贴纸装饰 */}
        {!isDark ? (
          <View pointerEvents="none" style={{ position: "absolute", top: 10, right: 92 }}>
            <StickerStar color={colors.candySun} size={18} />
          </View>
        ) : null}
        {!isDark ? (
          <View pointerEvents="none" style={{ position: "absolute", top: 8, right: 14, opacity: 0.95 }}>
            <StickerCloud size={34} />
          </View>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={{ flex: 1, gap: 6 }}>
            <AppText variant="small" tone="primary" style={{ fontWeight: "800" }}>
              今日进度
            </AppText>
            <AppText variant="title" style={{ color: colors.primaryInk, fontSize: 24, lineHeight: 30 }}>
              {progressTitle}
            </AppText>
            <AppText variant="small" tone="muted">
              {progressHint}
            </AppText>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
              {typeof streakDays === "number" && streakDays > 0 ? (
                <View
                  style={{
                    backgroundColor: isDark ? colors.surface : "rgba(255,255,255,0.88)",
                    borderRadius: radius.pill,
                    paddingHorizontal: 11,
                    paddingVertical: 7,
                    ...shadow.soft
                  }}
                >
                  <AppText variant="small" tone="primary" style={{ fontWeight: "800" }}>
                    🔥 连续 {streakDays} 天
                  </AppText>
                </View>
              ) : null}

              {typeof xpBalance === "number" ? (
                <Pressable
                  onPress={onPressXp}
                  style={{
                    backgroundColor: isDark ? colors.surface : "rgba(255,255,255,0.88)",
                    borderRadius: radius.pill,
                    paddingHorizontal: 11,
                    paddingVertical: 7,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    ...shadow.soft
                  }}
                >
                  <AppText variant="small" style={{ color: colors.partnerInk, fontWeight: "800" }}>
                    💎 {xpBalance} XP
                  </AppText>
                  {xpAccessory}
                </Pressable>
              ) : null}
            </View>
          </View>

          <ProgressRing ratio={ratio} />
        </View>
      </View>

      {showWeekStrip ? <WeekStrip doneDateKeys={doneDateKeys} /> : null}
    </View>
  );
}
