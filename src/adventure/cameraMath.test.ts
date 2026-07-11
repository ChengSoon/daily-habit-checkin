import { describe, expect, it } from "vitest";
import {
  CAMERA_PITCH_RAD,
  cameraPositionFor,
  clampCameraDistance,
  clampCameraTarget,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
  nextQualityTier,
  panToWorldDelta
} from "./cameraMath";

const bounds = { minX: -20, maxX: 20, minZ: -100, maxZ: 10 };

describe("clampCameraTarget", () => {
  it("界内不变", () => {
    expect(clampCameraTarget(0, -50, bounds)).toEqual([0, -50]);
  });
  it("越界钳制", () => {
    expect(clampCameraTarget(99, 99, bounds)).toEqual([20, 10]);
    expect(clampCameraTarget(-99, -999, bounds)).toEqual([-20, -100]);
  });
});

describe("clampCameraDistance", () => {
  it("限制在最小最大之间", () => {
    expect(clampCameraDistance(1)).toBe(MIN_CAMERA_DISTANCE);
    expect(clampCameraDistance(999)).toBe(MAX_CAMERA_DISTANCE);
    expect(clampCameraDistance(20)).toBe(20);
  });
});

describe("panToWorldDelta", () => {
  it("整屏高度拖动约等于 1.2 倍距离", () => {
    const [, dz] = panToWorldDelta(0, -800, 20, 800);
    expect(dz).toBeCloseTo(-24, 5);
  });
  it("距离越远平移越快", () => {
    const near = panToWorldDelta(100, 0, MIN_CAMERA_DISTANCE, 800)[0];
    const far = panToWorldDelta(100, 0, MAX_CAMERA_DISTANCE, 800)[0];
    expect(Math.abs(far)).toBeGreaterThan(Math.abs(near));
  });
});

describe("cameraPositionFor", () => {
  it("俯视角度固定", () => {
    const [x, y, z] = cameraPositionFor([0, 0, -10], 20);
    expect(x).toBe(0);
    expect(y).toBeCloseTo(20 * Math.sin(CAMERA_PITCH_RAD), 5);
    expect(z).toBeCloseTo(-10 + 20 * Math.cos(CAMERA_PITCH_RAD), 5);
  });
});

describe("nextQualityTier", () => {
  it("低帧升档", () => {
    expect(nextQualityTier(0, 30)).toBe(1);
    expect(nextQualityTier(1, 30)).toBe(2);
    expect(nextQualityTier(2, 30)).toBe(2);
  });
  it("高帧降档", () => {
    expect(nextQualityTier(2, 60)).toBe(1);
    expect(nextQualityTier(0, 60)).toBe(0);
  });
  it("中间帧率维持", () => {
    expect(nextQualityTier(1, 45)).toBe(1);
  });
});
