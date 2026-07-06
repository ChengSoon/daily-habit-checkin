import { describe, expect, it } from "vitest";
import { getAdjustmentSuggestion } from "./adjustmentRules";

describe("getAdjustmentSuggestion", () => {
  it("suggests lightening the goal when 7-day completion is below 40%", () => {
    const result = getAdjustmentSuggestion({
      completionRate7Days: 30,
      currentStreak: 2,
      planEnded: false
    });

    expect(result?.actionLabel).toBe("调整计划");
    expect(result?.title).toBe("把目标调轻一点");
  });

  it("suggests holding the pace on a 7-day streak", () => {
    const result = getAdjustmentSuggestion({
      completionRate7Days: 80,
      currentStreak: 7,
      planEnded: false
    });

    expect(result?.actionLabel).toBe("继续保持");
  });

  it("suggests next stage when the plan has ended", () => {
    const result = getAdjustmentSuggestion({
      completionRate7Days: 60,
      currentStreak: 3,
      planEnded: true
    });

    expect(result?.actionLabel).toBe("生成下一阶段");
  });

  it("returns null when no condition is met and no manual request", () => {
    const result = getAdjustmentSuggestion({
      completionRate7Days: 60,
      currentStreak: 3,
      planEnded: false
    });

    expect(result).toBeNull();
  });

  it("returns a gentle suggestion when the user manually asks to adjust", () => {
    const result = getAdjustmentSuggestion({
      completionRate7Days: 60,
      currentStreak: 3,
      planEnded: false,
      manualRequested: true
    });

    expect(result?.actionLabel).toBe("调整计划");
    expect(result?.title).toBe("想调整一下节奏？");
  });

  it("prioritizes the low-completion suggestion over a manual request", () => {
    const result = getAdjustmentSuggestion({
      completionRate7Days: 20,
      currentStreak: 1,
      planEnded: false,
      manualRequested: true
    });

    expect(result?.title).toBe("把目标调轻一点");
  });
});
