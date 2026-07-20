import { describe, expect, it } from "vitest";
import {
  bondPresentation,
  chatClearConfirmation,
  memoryCategoryLabel,
  memoryDeleteConfirmation,
  normalizeMemberPreferences
} from "./companionSettingsModel";

describe("companion settings model", () => {
  it("presents all four monotonic bond stages", () => {
    expect(bondPresentation({ points: 0, stage: "first_meeting" })).toMatchObject({
      label: "初次相遇",
      progress: 0
    });
    expect(bondPresentation({ points: 20, stage: "getting_familiar" }).label).toBe("渐渐熟悉");
    expect(bondPresentation({ points: 60, stage: "in_sync" }).label).toBe("很有默契");
    expect(bondPresentation({ points: 120, stage: "long_companionship" })).toMatchObject({
      label: "长久相伴",
      progress: 1
    });
  });

  it("uses concrete shared-impact confirmation copy", () => {
    expect(memoryDeleteConfirmation("一起坚持散步")).toContain("双方");
    expect(memoryDeleteConfirmation("一起坚持散步")).toContain("一起坚持散步");
    expect(chatClearConfirmation()).toContain("90 天");
    expect(chatClearConfirmation()).toContain("双方");
  });

  it("labels memory categories and normalizes member preferences", () => {
    expect(memoryCategoryLabel("encouragement_style")).toBe("鼓励方式");
    expect(normalizeMemberPreferences(false, "restrained")).toEqual({
      petVisible: false,
      proactiveMode: "restrained"
    });
  });
});
