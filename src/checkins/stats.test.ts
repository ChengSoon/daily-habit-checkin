import { describe, expect, it } from "vitest";
import { calculateCurrentStreak, calculateLongestStreak, calculateMonthlyCompletionRate } from "./stats";
import { CheckIn } from "./types";

const completed = (date: string): CheckIn => ({
  id: `checkin-${date}`,
  habitId: "habit-1",
  date,
  status: "completed",
  value: null,
  note: null,
  createdAt: `${date}T10:00:00.000Z`,
  createdBy: null
});

describe("check-in stats", () => {
  it("counts current streak across completed execution days", () => {
    const result = calculateCurrentStreak({
      today: "2026-07-05",
      scheduledDates: ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05"],
      checkIns: [completed("2026-07-03"), completed("2026-07-04"), completed("2026-07-05")]
    });

    expect(result).toBe(3);
  });

  it("does not break streak on non-execution days", () => {
    const result = calculateCurrentStreak({
      today: "2026-07-05",
      scheduledDates: ["2026-07-01", "2026-07-03", "2026-07-05"],
      checkIns: [completed("2026-07-01"), completed("2026-07-03"), completed("2026-07-05")]
    });

    expect(result).toBe(3);
  });

  it("calculates monthly completion rate", () => {
    const result = calculateMonthlyCompletionRate({
      scheduledDates: ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"],
      checkIns: [completed("2026-07-01"), completed("2026-07-04")]
    });

    expect(result).toBe(50);
  });

  it("calculates longest streak", () => {
    const result = calculateLongestStreak({
      scheduledDates: ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05"],
      checkIns: [completed("2026-07-01"), completed("2026-07-02"), completed("2026-07-04")]
    });

    expect(result).toBe(2);
  });
});
