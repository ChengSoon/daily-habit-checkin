import { useCallback, useEffect, useRef, useState } from "react";
import type { PetAnimationState } from "./types";

export type PetActionName =
  | "greeting"
  | "petting"
  | "playful"
  | "celebrate"
  | "curious";

export type PetActionStep = {
  state: PetAnimationState;
  durationMs: number;
};

export const PET_ACTIONS: Record<PetActionName, readonly PetActionStep[]> = {
  greeting: [
    { state: "waiting", durationMs: 240 },
    { state: "waving", durationMs: 1120 },
    { state: "idle", durationMs: 320 }
  ],
  petting: [
    { state: "waiting", durationMs: 260 },
    { state: "review", durationMs: 860 },
    { state: "jumping", durationMs: 820 },
    { state: "idle", durationMs: 260 }
  ],
  playful: [
    { state: "running-right", durationMs: 620 },
    { state: "running-left", durationMs: 620 },
    { state: "jumping", durationMs: 900 },
    { state: "idle", durationMs: 260 }
  ],
  celebrate: [
    { state: "waving", durationMs: 760 },
    { state: "jumping", durationMs: 900 },
    { state: "waving", durationMs: 680 },
    { state: "idle", durationMs: 260 }
  ],
  curious: [
    { state: "review", durationMs: 860 },
    { state: "waiting", durationMs: 740 },
    { state: "idle", durationMs: 280 }
  ]
};

export function totalPetActionDuration(action: PetActionName): number {
  return PET_ACTIONS[action].reduce((total, step) => total + step.durationMs, 0);
}

export function usePetActionPlayer() {
  const [animation, setAnimation] = useState<PetAnimationState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = useRef(0);

  const stop = useCallback(() => {
    token.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setAnimation(null);
  }, []);

  const play = useCallback((action: PetActionName) => {
    token.current += 1;
    const currentToken = token.current;
    if (timer.current) clearTimeout(timer.current);
    let stepIndex = 0;
    const steps = PET_ACTIONS[action];

    const advance = () => {
      if (currentToken !== token.current) return;
      const step = steps[stepIndex];
      setAnimation(step.state);
      timer.current = setTimeout(() => {
        if (stepIndex === steps.length - 1) {
          timer.current = null;
          setAnimation(null);
          return;
        }
        stepIndex += 1;
        advance();
      }, step.durationMs);
    };

    advance();
  }, []);

  useEffect(
    () => () => {
      token.current += 1;
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return { animation, play, stop };
}
