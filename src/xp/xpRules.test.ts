import { describe, expect, it } from "vitest";
import { calculateCheckInXpAwards } from "./xpRules";

describe("xp rules", () => {
  it("awards base check-in XP", () => {
    const awards = calculateCheckInXpAwards({
      habitId: "habit_1",
      dateKey: "2026-07-06",
      scheduledDates: ["2026-07-06"],
      completedDates: ["2026-07-06"],
      hasAnyEarlierCompletion: false,
      planCompleted: false
    });

    expect(awards).toEqual([
      { reason: "checkin", amount: 10, label: "完成打卡", uniqueKey: "checkin:habit_1:2026-07-06" }
    ]);
  });

  it("awards streak bonuses when the current streak reaches 3 or 7", () => {
    expect(
      calculateCheckInXpAwards({
        habitId: "habit_1",
        dateKey: "2026-07-03",
        scheduledDates: ["2026-07-01", "2026-07-02", "2026-07-03"],
        completedDates: ["2026-07-01", "2026-07-02", "2026-07-03"],
        hasAnyEarlierCompletion: true,
        planCompleted: false
      }).map((award) => award.reason)
    ).toEqual(["checkin", "streak_3"]);

    expect(
      calculateCheckInXpAwards({
        habitId: "habit_1",
        dateKey: "2026-07-07",
        scheduledDates: [
          "2026-07-01",
          "2026-07-02",
          "2026-07-03",
          "2026-07-04",
          "2026-07-05",
          "2026-07-06",
          "2026-07-07"
        ],
        completedDates: [
          "2026-07-01",
          "2026-07-02",
          "2026-07-03",
          "2026-07-04",
          "2026-07-05",
          "2026-07-06",
          "2026-07-07"
        ],
        hasAnyEarlierCompletion: true,
        planCompleted: false
      }).map((award) => award.reason)
    ).toEqual(["checkin", "streak_7"]);
  });

  it("awards return bonus after a missed scheduled day", () => {
    const awards = calculateCheckInXpAwards({
      habitId: "habit_1",
      dateKey: "2026-07-04",
      scheduledDates: ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"],
      completedDates: ["2026-07-01", "2026-07-02", "2026-07-04"],
      hasAnyEarlierCompletion: true,
      planCompleted: false
    });

    expect(awards.map((award) => award.reason)).toEqual(["checkin", "return_bonus"]);
  });

  it("awards plan completion bonus once the plan is complete", () => {
    const awards = calculateCheckInXpAwards({
      habitId: "habit_1",
      dateKey: "2026-07-21",
      scheduledDates: ["2026-07-21"],
      completedDates: ["2026-07-21"],
      hasAnyEarlierCompletion: true,
      planCompleted: true
    });

    expect(awards.map((award) => award.reason)).toEqual(["checkin", "plan_complete"]);
  });
});
