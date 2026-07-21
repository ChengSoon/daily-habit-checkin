import { describe, expect, it } from "vitest";
import {
  animationForQuickAction,
  feedbackForQuickAction,
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

    expect(mood).toEqual({
      quickActionsOpen: false,
      moodSheetOpen: true,
      breathingOpen: false
    });
    expect(petInteractionReducer(mood, { type: "dismissed" })).toEqual(
      initialPetInteractionState
    );
  });

  it("opens a breathing session and resets overlays after petting", () => {
    const breathing = petInteractionReducer(initialPetInteractionState, {
      type: "breathing_selected"
    });

    expect(breathing).toEqual({
      quickActionsOpen: false,
      moodSheetOpen: false,
      breathingOpen: true
    });
    expect(petInteractionReducer(breathing, { type: "pet_long_pressed" })).toEqual(
      initialPetInteractionState
    );
  });

  it("uses the existing review animation for reflection", () => {
    expect(animationForQuickAction("reflection")).toBe("review");
    expect(animationForQuickAction("encouragement")).toBe("jumping");
  });

  it("provides immediate and quiet feedback for requested actions", () => {
    expect(feedbackForQuickAction("encouragement")).toEqual({
      pending: "我来给你一点动力…",
      quiet: "收到，先做最轻的一步，我陪你。"
    });
    expect(feedbackForQuickAction("reflection")).toEqual({
      pending: "我来陪你回顾今天…",
      quiet: "收到，等你想回顾时，我们一起慢慢看。"
    });
  });
});
