import { describe, expect, it } from "vitest";
import { getStreakMilestone, STREAK_MILESTONES } from "./milestones";

describe("getStreakMilestone", () => {
  it("恰好命中里程碑天数时返回该天数", () => {
    for (const days of STREAK_MILESTONES) {
      expect(getStreakMilestone(days)).toBe(days);
    }
  });

  it("非里程碑天数返回 null", () => {
    expect(getStreakMilestone(0)).toBeNull();
    expect(getStreakMilestone(1)).toBeNull();
    expect(getStreakMilestone(6)).toBeNull();
    expect(getStreakMilestone(8)).toBeNull();
    expect(getStreakMilestone(29)).toBeNull();
    expect(getStreakMilestone(31)).toBeNull();
  });

  it("里程碑从 7 天起步，避免第一天就全屏打断", () => {
    for (let days = 1; days < 7; days += 1) {
      expect(getStreakMilestone(days)).toBeNull();
    }
  });
});
