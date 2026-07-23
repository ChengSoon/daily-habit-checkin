import type { PetAnimationState, PetMood, PetTravelState } from "./types";

export const PET_ATLAS = {
  width: 1536,
  height: 1872,
  columns: 8,
  rows: 9,
  cellWidth: 192,
  cellHeight: 208
} as const;

export const PET_DANCE_ATLAS = {
  width: 1536,
  height: 208,
  columns: 8,
  rows: 1,
  cellWidth: 192,
  cellHeight: 208
} as const;

export type PetAnimationPlayback = "loop" | "ping-pong" | "once-hold";

export type PetAnimationDefinition = {
  row: number;
  frameDurations: readonly number[];
  playback: PetAnimationPlayback;
  sheet?: "dancing";
};

export const PET_ANIMATIONS: Record<PetAnimationState, PetAnimationDefinition> = {
  idle: { row: 0, frameDurations: [800, 120, 90, 150, 900, 1050], playback: "loop" },
  "running-right": {
    row: 1,
    frameDurations: [110, 120, 110, 120, 110, 120, 110, 150],
    playback: "loop"
  },
  "running-left": {
    row: 2,
    frameDurations: [110, 120, 110, 120, 110, 120, 110, 150],
    playback: "loop"
  },
  waving: { row: 3, frameDurations: [160, 130, 150, 320], playback: "ping-pong" },
  jumping: { row: 4, frameDurations: [180, 120, 160, 120, 280], playback: "once-hold" },
  failed: {
    row: 5,
    frameDurations: [170, 150, 170, 150, 150, 150, 150, 260],
    playback: "once-hold"
  },
  waiting: { row: 6, frameDurations: [180, 140, 160, 170, 180, 300], playback: "ping-pong" },
  running: { row: 7, frameDurations: [150, 130, 140, 150, 150, 280], playback: "ping-pong" },
  review: { row: 8, frameDurations: [170, 140, 160, 170, 180, 320], playback: "ping-pong" },
  dancing: {
    row: 0,
    frameDurations: [140, 110, 110, 130, 110, 110, 120, 170],
    playback: "loop",
    sheet: "dancing"
  }
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

export function animationFrameSequence(
  state: PetAnimationState,
  reversed = false
): readonly number[] {
  const animation = PET_ANIMATIONS[state];
  const frames = animation.frameDurations.map((_, frame) => frame);
  const sequence =
    animation.playback === "ping-pong" && frames.length >= 3
      ? [...frames, ...frames.slice(1, -1).reverse()]
      : frames;
  return reversed ? [...sequence].reverse() : sequence;
}

export function frameAtElapsed(
  state: PetAnimationState,
  elapsedMs: number,
  reducedMotion = false
): number {
  if (reducedMotion || elapsedMs <= 0) return 0;

  const animation = PET_ANIMATIONS[state];
  const sequence = animationFrameSequence(state);
  const durationAt = (sequenceIndex: number) =>
    animation.frameDurations[sequence[sequenceIndex]];
  const cycleMs = sequence.reduce((sum, _, index) => sum + durationAt(index), 0);
  if (animation.playback === "once-hold" && elapsedMs >= cycleMs) return sequence[sequence.length - 1];
  let remaining = elapsedMs % cycleMs;

  for (let sequenceIndex = 0; sequenceIndex < sequence.length; sequenceIndex += 1) {
    if (remaining < durationAt(sequenceIndex)) return sequence[sequenceIndex];
    remaining -= durationAt(sequenceIndex);
  }
  return sequence[0];
}

export function motionStateForDelta(
  deltaX: number,
  threshold = 3
): PetTravelState | null {
  if (Math.abs(deltaX) < threshold) return null;
  return deltaX > 0 ? "running-right" : "running-left";
}

export function motionStateForGesture(
  input: { deltaX: number; deltaY: number; velocityX?: number; velocityY?: number; threshold?: number }
): PetAnimationState | null {
  const { deltaX, deltaY, velocityX = 0, velocityY = 0, threshold = 3 } = input;
  const horizontal = Math.abs(velocityX) > 0.04 ? velocityX : deltaX;
  const vertical = Math.abs(velocityY) > 0.04 ? velocityY : deltaY;
  if (Math.max(Math.abs(horizontal), Math.abs(vertical)) < threshold) return null;
  if (Math.abs(vertical) > Math.abs(horizontal) * 1.25) {
    return vertical < 0 ? "jumping" : "waiting";
  }
  return motionStateForDelta(horizontal, threshold);
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
