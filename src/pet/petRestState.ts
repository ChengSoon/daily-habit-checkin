import { useCallback, useEffect, useRef, useState } from "react";
import { PET_ANIMATIONS } from "./petAnimation";

export const PET_SLEEP_DELAY_MS = 45_000;
export const PET_REST_TRANSITION_MS = PET_ANIMATIONS.failed.frameDurations.reduce(
  (total, duration) => total + duration,
  0
);

export type PetRestState = "awake" | "sleeping" | "asleep" | "waking";
export type PetRestAction =
  | "inactivity_elapsed"
  | "sleep_completed"
  | "activity"
  | "wake_completed";
export type PetRestAnimation = {
  state: "failed";
  reversed: boolean;
};

export function petRestReducer(state: PetRestState, action: PetRestAction): PetRestState {
  if (action === "inactivity_elapsed" && state === "awake") return "sleeping";
  if (action === "sleep_completed" && state === "sleeping") return "asleep";
  if (action === "activity" && (state === "sleeping" || state === "asleep")) {
    return "waking";
  }
  if (action === "wake_completed" && state === "waking") return "awake";
  return state;
}

export function animationForPetRest(state: PetRestState): PetRestAnimation | null {
  if (state === "awake") return null;
  return { state: "failed", reversed: state === "waking" };
}

export function usePetRest() {
  const [state, setState] = useState<PetRestState>("awake");
  const stateRef = useRef<PetRestState>("awake");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transition = useCallback((action: PetRestAction) => {
    const next = petRestReducer(stateRef.current, action);
    stateRef.current = next;
    setState(next);
  }, []);

  const scheduleSleep = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      transition("inactivity_elapsed");
      timer.current = setTimeout(() => {
        transition("sleep_completed");
        timer.current = null;
      }, PET_REST_TRANSITION_MS);
    }, PET_SLEEP_DELAY_MS);
  }, [transition]);

  const markActivity = useCallback((): boolean => {
    const current = stateRef.current;
    if (current === "waking") return true;
    if (timer.current) clearTimeout(timer.current);
    if (current === "awake") {
      scheduleSleep();
      return false;
    }
    transition("activity");
    timer.current = setTimeout(() => {
      transition("wake_completed");
      scheduleSleep();
    }, PET_REST_TRANSITION_MS);
    return true;
  }, [scheduleSleep, transition]);

  useEffect(() => {
    scheduleSleep();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [scheduleSleep]);

  return { state, animation: animationForPetRest(state), markActivity };
}
