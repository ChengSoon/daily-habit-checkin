import { describe, expect, it } from "vitest";
import {
  animationForQuickAction,
  initialPetInteractionState,
  petInteractionReducer
} from "./petInteractionState";

describe("pet interaction state", () => {
  it("opens actions on tap and closes them when dragging", () => {
    const opened = petInteractionReducer(initialPetInteractionState, { type: "pet_tapped" });
    const dragged = petInteractionReducer(opened, { type: "drag_started" });

    expect(opened.quickActionsOpen).toBe(true);
    expect(dragged).toEqual(initialPetInteractionState);
  });

  it("opens mood check-in and dismisses all overlays", () => {
    const mood = petInteractionReducer(
      { ...initialPetInteractionState, quickActionsOpen: true },
      { type: "mood_selected" }
    );

    expect(mood).toEqual({ quickActionsOpen: false, moodSheetOpen: true });
    expect(petInteractionReducer(mood, { type: "dismissed" })).toEqual(
      initialPetInteractionState
    );
  });

  it("uses the existing review animation for reflection", () => {
    expect(animationForQuickAction("reflection")).toBe("review");
    expect(animationForQuickAction("encouragement")).toBe("jumping");
  });
});
