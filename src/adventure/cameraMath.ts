import type { CameraBounds } from "./voxelWorldLayout";

export const CAMERA_PITCH_RAD = 0.733;
export const MIN_CAMERA_DISTANCE = 10;
export const MAX_CAMERA_DISTANCE = 44;
const PAN_FACTOR = 1.2;

export function clampCameraTarget(x: number, z: number, bounds: CameraBounds): [number, number] {
  return [
    Math.min(bounds.maxX, Math.max(bounds.minX, x)),
    Math.min(bounds.maxZ, Math.max(bounds.minZ, z))
  ];
}

export function clampCameraDistance(distance: number): number {
  return Math.min(MAX_CAMERA_DISTANCE, Math.max(MIN_CAMERA_DISTANCE, distance));
}

export function panToWorldDelta(
  dxPx: number,
  dyPx: number,
  distance: number,
  viewportHeightPx: number
): [number, number] {
  const scale = (distance * PAN_FACTOR) / viewportHeightPx;
  return [dxPx * scale, dyPx * scale];
}

export function cameraPositionFor(
  target: [number, number, number],
  distance: number
): [number, number, number] {
  return [
    target[0],
    target[1] + distance * Math.sin(CAMERA_PITCH_RAD),
    target[2] + distance * Math.cos(CAMERA_PITCH_RAD)
  ];
}

export type QualityTier = 0 | 1 | 2;

export function nextQualityTier(current: QualityTier, avgFps: number): QualityTier {
  if (avgFps < 38) return Math.min(2, current + 1) as QualityTier;
  if (avgFps > 55) return Math.max(0, current - 1) as QualityTier;
  return current;
}
