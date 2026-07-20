import type { PetAnimationState } from "./types";

export type PetQuickAction = "chat" | "mood" | "encouragement" | "reflection";
export type PetInteractionState = { quickActionsOpen: boolean; moodSheetOpen: boolean };

export const initialPetInteractionState: PetInteractionState = {
  quickActionsOpen: false,
  moodSheetOpen: false
};

type PetInteractionAction =
  | { type: "pet_tapped" }
  | { type: "drag_started" | "dismissed" | "chat_selected" | "request_selected" }
  | { type: "mood_selected" };

export function petInteractionReducer(
  state: PetInteractionState,
  action: PetInteractionAction
): PetInteractionState {
  if (action.type === "pet_tapped") {
    return { quickActionsOpen: !state.quickActionsOpen, moodSheetOpen: false };
  }
  if (action.type === "mood_selected") {
    return { quickActionsOpen: false, moodSheetOpen: true };
  }
  return initialPetInteractionState;
}

export function animationForQuickAction(
  action: Extract<PetQuickAction, "encouragement" | "reflection">
): PetAnimationState {
  return action === "reflection" ? "review" : "jumping";
}
