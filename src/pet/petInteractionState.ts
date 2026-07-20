import type { PetAnimationState } from "./types";

export type PetQuickAction = "chat" | "mood" | "encouragement" | "reflection";
export type PetInteractionState = { quickActionsOpen: boolean; moodSheetOpen: boolean };

export type RequestedQuickAction = Extract<PetQuickAction, "encouragement" | "reflection">;

export type QuickActionFeedback = {
  pending: string;
  quiet: string;
};

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
  action: RequestedQuickAction
): PetAnimationState {
  return action === "reflection" ? "review" : "jumping";
}

export function feedbackForQuickAction(action: RequestedQuickAction): QuickActionFeedback {
  if (action === "reflection") {
    return {
      pending: "我来陪你回顾今天…",
      quiet: "收到，等你想回顾时，我们一起慢慢看。"
    };
  }

  return {
    pending: "我来给你一点动力…",
    quiet: "收到，先做最轻的一步，我陪你。"
  };
}
