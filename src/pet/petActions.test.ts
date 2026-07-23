import { describe, expect, it } from "vitest";
import { PET_ACTIONS, totalPetActionDuration } from "./petActions";

describe("pet action choreography", () => {
  it("每个动作都以安静的 idle 收势", () => {
    for (const steps of Object.values(PET_ACTIONS)) {
      expect(steps.at(-1)?.state).toBe("idle");
    }
  });

  it("把摸摸和玩耍拆成准备、主体、收势", () => {
    expect(PET_ACTIONS.petting.map((step) => step.state)).toEqual([
      "waiting",
      "review",
      "jumping",
      "idle"
    ]);
    expect(PET_ACTIONS.playful.map((step) => step.state)).toEqual([
      "running-right",
      "running-left",
      "dancing",
      "jumping",
      "idle"
    ]);
    expect(PET_ACTIONS.celebrate.map((step) => step.state)).toContain("dancing");
    expect(totalPetActionDuration("playful")).toBe(3520);
  });
});
