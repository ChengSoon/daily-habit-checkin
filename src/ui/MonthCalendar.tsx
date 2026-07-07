import { View } from "react-native";
import { AppText } from "./Controls";
import { radius, spacing } from "./theme";
import { useTheme } from "./ThemeContext";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 月历下方的图例项：filled 为实心色块，否则为描边（对应「今天」的样式）。
 * borderColor 可单独指定，用于浅底色块（如「错过」）在白色卡片上仍能辨认。
 */
export function CalendarLegend({
  color,
  label,
  filled = false,
  borderColor
}: {
  color: string;
  label: string;
  filled?: boolean;
  borderColor?: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: radius.pill,
          backgroundColor: filled ? color : "transparent",
          borderWidth: 2,
          borderColor: borderColor ?? color
        }}
      />
      <AppText variant="small" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

function pad2(value: number): string {
  return `${value}`.padStart(2, "0");
}

type DayCell = { key: string; day: number } | null;

/**
 * 把某个月拆成日历网格：前导空格补齐星期偏移，再排 1..月末。
 * monthDateKey 用月内任意日期（通常传今天）确定年月。
 */
function buildMonthGrid(monthDateKey: string): DayCell[] {
  const [year, month] = monthDateKey.split("-").map(Number);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: DayCell[] = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: `${year}-${pad2(month)}-${pad2(day)}`, day });
  }
  return cells;
}

/**
 * 月历视图：呈现当月每一天的打卡状态。
 * - 已完成：品牌绿实心
 * - 今天未完成：品牌色描边
 * - 应执行但错过（今天之前）：浅灰底
 * - 应执行的未来日期：普通数字
 * - 无需执行 / 习惯创建前：淡色数字
 */
export function MonthCalendar({
  monthDateKey,
  scheduledDates,
  completedDates,
  today,
  startDate
}: {
  monthDateKey: string;
  scheduledDates: Set<string>;
  completedDates: Set<string>;
  today: string;
  startDate: string;
}) {
  const { colors } = useTheme();
  const cells = buildMonthGrid(monthDateKey);

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: "row" }}>
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} style={{ width: `${100 / 7}%`, alignItems: "center", paddingVertical: 2 }}>
            <AppText variant="caption" tone="faint">
              {label}
            </AppText>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((cell, index) => {
          if (!cell) {
            return <View key={`blank-${index}`} style={{ width: `${100 / 7}%`, paddingVertical: 3 }} />;
          }

          const inRange = cell.key >= startDate;
          const isScheduled = inRange && scheduledDates.has(cell.key);
          const isDone = completedDates.has(cell.key);
          const isToday = cell.key === today;
          const isPast = cell.key < today;
          const isMissed = isScheduled && !isDone && isPast;

          let backgroundColor = "transparent";
          let borderColor = "transparent";
          let textTone: "onPrimary" | "primary" | "default" | "muted" | "faint" = "faint";

          if (isDone) {
            backgroundColor = colors.primary;
            borderColor = colors.primary;
            textTone = "onPrimary";
          } else if (isToday) {
            borderColor = colors.primary;
            textTone = "primary";
          } else if (isMissed) {
            backgroundColor = colors.surfaceMuted;
            textTone = "muted";
          } else if (isScheduled) {
            textTone = "default";
          }

          return (
            <View
              key={cell.key}
              style={{ width: `${100 / 7}%`, alignItems: "center", paddingVertical: 3 }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor,
                  borderWidth: 2,
                  borderColor
                }}
              >
                <AppText
                  variant="small"
                  tone={textTone}
                  style={{ fontWeight: isToday || isDone ? "700" : "400" }}
                >
                  {cell.day}
                </AppText>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
