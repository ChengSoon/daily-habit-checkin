import { describe, expect, it } from "vitest";
import type { PetMood } from "./types";
import {
  PET_ANIMATIONS,
  animationFrameSequence,
  animationForMood,
  clampPetOffset,
  frameAtElapsed,
  motionStateForGesture,
  motionStateForDelta
} from "./petAnimation";

describe("PET_ANIMATIONS", () => {
  it("遵循 hatch-pet 的九行动画契约", () => {
    expect(
      Object.entries(PET_ANIMATIONS).map(([state, animation]) => [
        state,
        animation.row,
        animation.frameDurations.length
      ])
    ).toEqual([
      ["idle", 0, 6],
      ["running-right", 1, 8],
      ["running-left", 2, 8],
      ["waving", 3, 4],
      ["jumping", 4, 5],
      ["failed", 5, 8],
      ["waiting", 6, 6],
      ["running", 7, 6],
      ["review", 8, 6]
    ]);
  });
});

describe("animationForMood", () => {
  it.each<[PetMood, string]>([
    ["idle", "idle"],
    ["happy", "jumping"],
    ["thinking", "running"],
    ["waiting", "waiting"],
    ["sad", "failed"],
    ["wave", "waving"]
  ])("把 %s 映射为 %s", (mood, expected) => {
    expect(animationForMood(mood)).toBe(expected);
  });
});

describe("frameAtElapsed", () => {
  it("按当前帧持续时间推进并在周期末回到首帧", () => {
    expect(frameAtElapsed("idle", 0)).toBe(0);
    expect(frameAtElapsed("idle", 279)).toBe(0);
    expect(frameAtElapsed("idle", 799)).toBe(0);
    expect(frameAtElapsed("idle", 800)).toBe(1);
    expect(frameAtElapsed("idle", 920)).toBe(2);
    expect(frameAtElapsed("idle", 3110)).toBe(0);
  });

  it("让叙事动作自然收势，不从末帧跳回首帧", () => {
    expect(animationFrameSequence("review")).toEqual([0, 1, 2, 3, 4, 5, 4, 3, 2, 1]);
    expect(animationFrameSequence("failed", true)).toEqual([7, 6, 5, 4, 3, 2, 1, 0]);
    expect(frameAtElapsed("review", 1139)).toBe(5);
    expect(frameAtElapsed("review", 1790)).toBe(0);
    expect(frameAtElapsed("jumping", 1000)).toBe(4);
  });

  it("减少动态效果时始终返回首帧", () => {
    expect(frameAtElapsed("jumping", 560, true)).toBe(0);
  });
});

describe("motionStateForDelta", () => {
  it("忽略轻微抖动并按水平拖动方向选择行动画", () => {
    expect(motionStateForDelta(1)).toBeNull();
    expect(motionStateForDelta(5)).toBe("running-right");
    expect(motionStateForDelta(-5)).toBe("running-left");
  });
});

describe("motionStateForGesture", () => {
  it("把明显的上下拖动映射为跳跃和等待", () => {
    expect(motionStateForGesture(4, -24)).toBe("jumping");
    expect(motionStateForGesture(-3, 24)).toBe("waiting");
  });

  it("保留横向拖动的方向步态", () => {
    expect(motionStateForGesture(28, 3)).toBe("running-right");
    expect(motionStateForGesture(-28, 3)).toBe("running-left");
  });
});

describe("clampPetOffset", () => {
  const bounds = {
    screenWidth: 390,
    screenHeight: 844,
    petWidth: 96,
    petHeight: 126,
    horizontalMargin: 14,
    bottomInset: 96,
    topInset: 48
  };

  it("把右下角锚定偏移限制在安全可视区域", () => {
    expect(clampPetOffset({ x: 40, y: 20 }, bounds)).toEqual({ x: 0, y: 0 });
    expect(clampPetOffset({ x: -999, y: -999 }, bounds)).toEqual({
      x: -266,
      y: -574
    });
    expect(clampPetOffset({ x: -120, y: -80 }, bounds)).toEqual({
      x: -120,
      y: -80
    });
  });
});
