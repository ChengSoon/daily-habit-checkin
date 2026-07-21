import { describe, expect, it } from "vitest";
import { animationForPetRest, petRestReducer } from "./petRestState";

describe("pet rest state", () => {
  it("长时间没有互动后躺下并停在睡姿", () => {
    const sleeping = petRestReducer("awake", "inactivity_elapsed");
    const asleep = petRestReducer(sleeping, "sleep_completed");

    expect(sleeping).toBe("sleeping");
    expect(asleep).toBe("asleep");
    expect(animationForPetRest(asleep)).toEqual({ state: "failed", reversed: false });
  });

  it("触摸睡着的卡卡会反向播放起身动作", () => {
    const waking = petRestReducer("asleep", "activity");
    const awake = petRestReducer(waking, "wake_completed");

    expect(waking).toBe("waking");
    expect(animationForPetRest(waking)).toEqual({ state: "failed", reversed: true });
    expect(awake).toBe("awake");
    expect(animationForPetRest(awake)).toBeNull();
  });

  it("普通互动只重置计时，不吞掉本次操作", () => {
    expect(petRestReducer("awake", "activity")).toBe("awake");
  });
});
