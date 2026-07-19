import { describe, expect, it } from "vitest";
import { greetingBubble, reactionForCheckIn, reactionForError } from "./petMood";

describe("reactionForCheckIn", () => {
  it("优先里程碑", () => {
    const r = reactionForCheckIn({
      habitName: "早起",
      streak: 7,
      milestoneDays: 7
    });
    expect(r.mood).toBe("happy");
    expect(r.bubble).toContain("7");
  });

  it("全勤文案", () => {
    const r = reactionForCheckIn({ habitName: "阅读", streak: 1, allDone: true });
    expect(r.bubble).toContain("全勤");
  });
});

describe("reactionForError", () => {
  it("截断过长错误", () => {
    const r = reactionForError("x".repeat(80));
    expect(r.mood).toBe("sad");
    expect(r.bubble.length).toBeLessThanOrEqual(48);
  });
});

describe("greetingBubble", () => {
  it("按时段变化", () => {
    expect(greetingBubble(9)).toContain("早上");
    expect(greetingBubble(15)).toContain("下午");
    expect(greetingBubble(21)).toContain("晚上");
  });
});
