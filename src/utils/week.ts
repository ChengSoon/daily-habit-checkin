import { addDays, todayKey, toDateKey } from "./date";

export type WeekDayStatus = "done" | "partial" | "empty" | "future" | "today";

export type WeekDayItem = {
  dateKey: string;
  /** 周一…日 */
  weekdayLabel: string;
  dayNumber: number;
  isToday: boolean;
  status: WeekDayStatus;
};

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

/** 生成以「本周」为单位的 7 天（周一为起点）。 */
export function buildCurrentWeekDays(reference = new Date()): WeekDayItem[] {
  const today = todayKey();
  const ref = new Date(reference);
  const day = ref.getDay(); // 0=Sun
  // 周一为起点：Sun->-6, Mon->0, Tue->-1 ...
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() + mondayOffset);
  const mondayKey = toDateKey(monday);

  return Array.from({ length: 7 }, (_, index) => {
    const dateKey = addDays(mondayKey, index);
    const date = new Date(`${dateKey}T00:00:00`);
    const isToday = dateKey === today;
    let status: WeekDayStatus = "empty";
    if (dateKey > today) {
      status = "future";
    } else if (isToday) {
      status = "today";
    }
    return {
      dateKey,
      weekdayLabel: WEEKDAY_LABELS[date.getDay()],
      dayNumber: date.getDate(),
      isToday,
      status
    };
  });
}
