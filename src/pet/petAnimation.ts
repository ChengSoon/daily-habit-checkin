import type { PetAnimationState, PetMood, PetTravelState } from "./types";

export const PET_ATLAS = {
  width: 1536,
  height: 1872,
  columns: 8,
  rows: 9,
  cellWidth: 192,
  cellHeight: 208
} as const;

type PetAnimationDefinition = {
  row: number;
  frameDurations: readonly number[];
};

export const PET_ANIMATIONS: Record<PetAnimationState, PetAnimationDefinition> = {
  idle: { row: 0, frameDurations: [280, 110, 110, 140, 140, 320] },
  "running-right": { row: 1, frameDurations: [120, 120, 120, 120, 120, 120, 120, 220] },
  "running-left": { row: 2, frameDurations: [120, 120, 120, 120, 120, 120, 120, 220] },
  waving: { row: 3, frameDurations: [140, 140, 140, 280] },
  jumping: { row: 4, frameDurations: [140, 140, 140, 140, 280] },
  failed: { row: 5, frameDurations: [140, 140, 140, 140, 140, 140, 140, 240] },
  waiting: { row: 6, frameDurations: [150, 150, 150, 150, 150, 260] },
  running: { row: 7, frameDurations: [120, 120, 120, 120, 120, 220] },
  review: { row: 8, frameDurations: [150, 150, 150, 150, 150, 280] }
};

const MOOD_ANIMATIONS: Record<PetMood, PetAnimationState> = {
  idle: "idle",
  happy: "jumping",
  thinking: "running",
  waiting: "waiting",
  sad: "failed",
  wave: "waving"
};

export function animationForMood(mood: PetMood): PetAnimationState {
  return MOOD_ANIMATIONS[mood];
}

export function frameAtElapsed(
  state: PetAnimationState,
  elapsedMs: number,
  reducedMotion = false
): number {
  if (reducedMotion || elapsedMs <= 0) return 0;

  const durations = PET_ANIMATIONS[state].frameDurations;
  const cycleMs = durations.reduce((sum, duration) => sum + duration, 0);
  let remaining = elapsedMs % cycleMs;

  for (let frame = 0; frame < durations.length; frame += 1) {
    if (remaining < durations[frame]) return frame;
    remaining -= durations[frame];
  }
  return 0;
}

export function motionStateForDelta(
  deltaX: number,
  threshold = 3
): PetTravelState | null {
  if (Math.abs(deltaX) < threshold) return null;
  return deltaX > 0 ? "running-right" : "running-left";
}

type PetOffset = { x: number; y: number };

type PetDragBounds = {
  screenWidth: number;
  screenHeight: number;
  petWidth: number;
  petHeight: number;
  horizontalMargin: number;
  bottomInset: number;
  topInset: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function clampPetOffset(offset: PetOffset, bounds: PetDragBounds): PetOffset {
  const horizontalTravel = Math.max(
    0,
    bounds.screenWidth - bounds.petWidth - bounds.horizontalMargin * 2
  );
  const verticalTravel = Math.max(
    0,
    bounds.screenHeight - bounds.bottomInset - bounds.petHeight - bounds.topInset
  );
  return {
    x: clamp(offset.x, -horizontalTravel, 0),
    y: clamp(offset.y, -verticalTravel, 0)
  };
}
