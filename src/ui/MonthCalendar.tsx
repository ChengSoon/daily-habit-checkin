import { View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { AppText } from "./Controls";
import { useTheme } from "./ThemeContext";

// board 06：周一起算
const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

/**
 * 月历下方的图例项：filled 为实心色块，否则为描边（对应「今天」的样式）。
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
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 9,
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

/** 周一为首的月份网格。 */
function buildMonthGrid(monthDateKey: string): DayCell[] {
  const [year, month] = monthDateKey.split("-").map(Number);
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
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
 * 月历视图（对齐 board 06）：
 * - 你完成：薄荷绿底 + 绿字
 * - 双人完成：薰衣草紫底（bothDates）
 * - 今天：珊瑚描边
 * - 默认：浅灰底
 */
export function MonthCalendar({
  monthDateKey,
  scheduledDates,
  completedDates,
  bothDates,
  today,
  startDate
}: {
  monthDateKey: string;
  scheduledDates: Set<string>;
  completedDates: Set<string>;
  bothDates?: Set<string>;
  today: string;
  startDate: string;
}) {
  const { colors } = useTheme();
  const cells = buildMonthGrid(monthDateKey);
  const bothSet = bothDates ?? new Set<string>();
  const cellW = `${100 / 7}%` as const;

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row" }}>
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} style={{ width: cellW, alignItems: "center", paddingVertical: 2 }}>
            <AppText variant="caption" tone="faint" style={{ fontSize: 9, letterSpacing: 0, textTransform: "none" }}>
              {label}
            </AppText>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((cell, index) => {
          if (!cell) {
            return <View key={`blank-${index}`} style={{ width: cellW, padding: 2 }} />;
          }

          const inRange = cell.key >= startDate;
          const isScheduled = inRange && scheduledDates.has(cell.key);
          const isDone = completedDates.has(cell.key);
          const isBoth = bothSet.has(cell.key);
          const isToday = cell.key === today;
          const isPast = cell.key < today;
          const isMissed = isScheduled && !isDone && isPast;

          let backgroundColor = colors.surfaceMuted;
          let textColor = colors.muted;

          if (isBoth) {
            // board .d.both：珊瑚软→薰衣草紫渐变
            backgroundColor = "transparent";
            textColor = colors.ink;
          } else if (isDone) {
            backgroundColor = colors.successSurface;
            textColor = colors.candyMintInk;
          } else if (isMissed) {
            backgroundColor = colors.surfaceMuted;
            textColor = colors.muted;
          } else if (isScheduled) {
            backgroundColor = colors.surfaceMuted;
            textColor = colors.inkSoft;
          } else {
            backgroundColor = colors.surfaceMuted;
            textColor = colors.faint;
          }

          return (
            <View key={cell.key} style={{ width: cellW, padding: 2, alignItems: "center" }}>
              <View
                style={{
                  width: "100%",
                  aspectRatio: 1,
                  maxWidth: 40,
                  borderRadius: 9,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isBoth ? colors.surfaceTint : backgroundColor,
                  overflow: "hidden",
                  borderWidth: isToday ? 2 : 0,
                  borderColor: isToday ? colors.primary : "transparent"
                }}
              >
                {isBoth ? (
                  <Svg width={40} height={40} viewBox="0 0 40 40" style={{ position: "absolute" }}>
                    <Defs>
                      <LinearGradient id={`both-${cell.key}`} x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0%" stopColor={colors.surfaceTint} />
                        <Stop offset="100%" stopColor={colors.partnerSurface} />
                      </LinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width="40" height="40" fill={`url(#both-${cell.key})`} />
                  </Svg>
                ) : null}
                <AppText variant="small" style={{ color: textColor, fontWeight: "800", fontSize: 10, lineHeight: 12, zIndex: 1 }}>
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
