import { View } from "react-native";
import { todayKey } from "../utils/date";
import { buildCurrentWeekDays, WeekDayItem } from "../utils/week";
import { AppText } from "./Controls";
import { radius, shadow } from "./theme";
import { useTheme } from "./ThemeContext";

export type { WeekDayItem, WeekDayStatus } from "../utils/week";
export { buildCurrentWeekDays } from "../utils/week";

/**
 * 本周横向条：今日珊瑚高亮，已完成日薄荷绿，未来日淡色。
 * Soft 3D 打卡页核心氛围组件。
 */
export function WeekStrip({
  days,
  doneDateKeys
}: {
  days?: WeekDayItem[];
  /** 有任意打卡完成的日期（可选，用于点亮历史日） */
  doneDateKeys?: Set<string> | string[];
}) {
  const { colors } = useTheme();
  const doneSet =
    doneDateKeys instanceof Set
      ? doneDateKeys
      : new Set(doneDateKeys ?? []);
  const items = days ?? buildCurrentWeekDays();
  const today = todayKey();

  return (
    <View
      style={{
        flexDirection: "row",
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        ...shadow.soft
      }}
    >
      {items.map((item) => {
        const isDone = !item.isToday && doneSet.has(item.dateKey);
        const isFuture = item.dateKey > today;
        const isToday = item.isToday;

        let dayBg = "transparent";
        let dayFg = colors.inkSoft;
        let weekdayColor = colors.muted;
        let dotColor = "transparent";
        let cellBg = "transparent";

        if (isToday) {
          cellBg = colors.surfaceTint;
          dayBg = colors.primary;
          dayFg = colors.onPrimary;
          weekdayColor = colors.primaryInk;
          dotColor = colors.primary;
        } else if (isDone) {
          dayBg = colors.successSurface;
          dayFg = colors.success;
          dotColor = colors.success;
        } else if (isFuture) {
          dayFg = colors.faint;
        }

        return (
          <View
            key={item.dateKey}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 6,
              paddingVertical: 8,
              borderRadius: 14,
              backgroundColor: cellBg
            }}
          >
            <AppText
              variant="caption"
              style={{
                color: weekdayColor,
                textTransform: "none",
                letterSpacing: 0,
                fontSize: 10
              }}
            >
              {item.weekdayLabel}
            </AppText>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: radius.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: dayBg,
                ...(isToday
                  ? {
                      shadowColor: colors.primary,
                      shadowOpacity: 0.35,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 3
                    }
                  : null)
              }}
            >
              <AppText
                variant="small"
                style={{
                  color: dayFg,
                  fontWeight: "800",
                  fontSize: 12,
                  lineHeight: 16
                }}
              >
                {item.dayNumber}
              </AppText>
            </View>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: dotColor
              }}
            />
          </View>
        );
      })}
    </View>
  );
}
