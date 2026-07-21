import { describe, expect, it } from "vitest";
import { BREATHING_SESSION_MS, breathingFrameAt } from "./breathingSession";

describe("breathingFrameAt", () => {
  it("按 4 秒吸气、2 秒停留、6 秒呼气推进", () => {
    expect(breathingFrameAt(0)).toMatchObject({
      phase: "inhale",
      secondsRemaining: 4,
      cycle: 1
    });
    expect(breathingFrameAt(4000)).toMatchObject({
      phase: "hold",
      secondsRemaining: 2
    });
    expect(breathingFrameAt(6000)).toMatchObject({
      phase: "exhale",
      secondsRemaining: 6
    });
  });

  it("在新一轮回到吸气并累计轮次", () => {
    expect(breathingFrameAt(12_000)).toMatchObject({
      phase: "inhale",
      secondsRemaining: 4,
      cycle: 2
    });
  });

  it("三轮组成一次完整练习", () => {
    expect(BREATHING_SESSION_MS).toBe(36_000);
  });
});
