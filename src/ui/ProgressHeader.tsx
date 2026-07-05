import { View } from "react-native";
import { AppText } from "./Controls";
import { radius, spacing } from "./theme";
import { useTheme } from "./ThemeContext";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function ProgressHeader({ completed, total }: { completed: number; total: number }) {
  const { colors } = useTheme();
  const now = new Date();
  const dateLabel = `${now.getMonth() + 1} 月 ${now.getDate()} 日 · ${WEEKDAYS[now.getDay()]}`;
  const ratio = total === 0 ? 0 : completed / total;
  const allDone = total > 0 && completed === total;

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="caption" tone="muted">
          {dateLabel}
        </AppText>
        <AppText variant="display">今日</AppText>
      </View>
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <AppText variant="bodyStrong" tone="soft">
            {allDone ? "今天都完成了" : `已完成 ${completed}/${total}`}
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
          <View
            style={{
              width: `${Math.round(ratio * 100)}%`,
              height: "100%",
              borderRadius: radius.pill,
              backgroundColor: colors.primary
            }}
          />
        </View>
      </View>
    </View>
  );
}
