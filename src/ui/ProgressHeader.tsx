import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { CoupleAvatars, CouplePerson } from "./Avatar";
import { AppText } from "./Controls";
import { radius, spacing } from "./theme";
import { useTheme } from "./ThemeContext";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function ProgressHeader({
  completed,
  total,
  people = [],
  hasPartner = false
}: {
  completed: number;
  total: number;
  /** 情侣双方，用于成对头像。空数组时不显示头像。 */
  people?: CouplePerson[];
  /** 是否已有另一半加入，决定用「你们一起」还是单人文案。 */
  hasPartner?: boolean;
}) {
  const { colors } = useTheme();
  const now = new Date();
  const dateLabel = `${now.getMonth() + 1} 月 ${now.getDate()} 日 · ${WEEKDAYS[now.getDay()]}`;
  const ratio = total === 0 ? 0 : completed / total;
  const allDone = total > 0 && completed === total;
  const doneLabel = allDone
    ? hasPartner
      ? "你们今天都完成了 💞"
      : "今天都完成了"
    : `已完成 ${completed}/${total}`;

  // 打卡后进度条平滑推进，而不是跳变
  const progress = useSharedValue(ratio);
  useEffect(() => {
    progress.value = withTiming(ratio, { duration: 450, easing: Easing.out(Easing.cubic) });
  }, [progress, ratio]);
  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`
  }));

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ gap: spacing.xs, flex: 1 }}>
          <AppText variant="caption" tone="muted">
            {dateLabel}
          </AppText>
          <AppText variant="display">今日</AppText>
        </View>
        {people.length > 0 ? <CoupleAvatars people={people} size={38} /> : null}
      </View>
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <AppText variant="bodyStrong" tone="soft">
            {doneLabel}
          </AppText>
          {total > 0 ? (
            <AppText variant="small" tone="muted">
              {Math.round(ratio * 100)}%
            </AppText>
          ) : null}
        </View>
        <View
          style={{
            height: 8,
            borderRadius: radius.pill,
            backgroundColor: colors.surfaceMuted,
            overflow: "hidden"
          }}
        >
          <Animated.View
            style={[
              {
                height: "100%",
                borderRadius: radius.pill,
                backgroundColor: colors.primary
              },
              barStyle
            ]}
          />
        </View>
      </View>
    </View>
  );
}
