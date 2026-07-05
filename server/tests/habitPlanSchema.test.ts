import { describe, expect, it } from "vitest";
import { HabitPlanResponseSchema } from "../src/habitPlanSchema.js";

describe("HabitPlanResponseSchema", () => {
  it("accepts a valid 7 day plan", () => {
    const result = HabitPlanResponseSchema.parse({
      habitName: "每日阅读",
      description: "每天睡前阅读 10 分钟",
      durationDays: 7,
      dailyActions: Array.from({ length: 7 }, (_, index) => ({
        day: index + 1,
        action: `阅读 ${index + 1}0 分钟`,
        targetValue: 10
      })),
      recommendedReminderTime: "21:30",
      recommendedTrackType: "numeric",
      numericUnit: "分钟",
      fallbackAdvice: "如果太累，先读 5 分钟。",
      safetyNote: null
    });

    expect(result.durationDays).toBe(7);
  });
});
