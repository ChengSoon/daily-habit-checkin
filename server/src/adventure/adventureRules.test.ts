import { describe, expect, it } from "vitest";
import {
  advanceHighestUnlockedOrder,
  buildChapterViews,
  type AdventureChapterConfig
} from "./adventureRules.js";

const chapters: AdventureChapterConfig[] = [
  { id: "c1", sortOrder: 1, thresholdLifetimeXp: 50, status: "published" },
  { id: "c2", sortOrder: 2, thresholdLifetimeXp: 150, status: "published" },
  { id: "c3", sortOrder: 3, thresholdLifetimeXp: 300, status: "published" },
  { id: "draft", sortOrder: 4, thresholdLifetimeXp: 10, status: "draft" }
];

describe("advanceHighestUnlockedOrder", () => {
  it("starts at 0 and unlocks chapter 1 when lifetime enough", () => {
    expect(advanceHighestUnlockedOrder(chapters, 0, 49)).toBe(0);
    expect(advanceHighestUnlockedOrder(chapters, 0, 50)).toBe(1);
  });

  it("requires previous unlock before later chapters even if XP is high", () => {
    // highest=0 时即使 999 XP 也只能推到线性允许的最大连续前缀
    expect(advanceHighestUnlockedOrder(chapters, 0, 999)).toBe(3);
  });

  it("never decreases highest", () => {
    expect(advanceHighestUnlockedOrder(chapters, 2, 0)).toBe(2);
  });

  it("ignores draft/archived chapters in the linear chain", () => {
    expect(advanceHighestUnlockedOrder(chapters, 0, 999)).toBe(3);
  });
});

describe("buildChapterViews", () => {
  it("marks locked / claimable / claimed / locked-future", () => {
    const views = buildChapterViews({
      chapters,
      highestUnlockedOrder: 2,
      claimedChapterIds: new Set(["c1"]),
      lifetimeEarned: 200
    });
    expect(views.find((v) => v.id === "c1")?.viewStatus).toBe("claimed");
    expect(views.find((v) => v.id === "c2")?.viewStatus).toBe("claimable");
    expect(views.find((v) => v.id === "c3")?.viewStatus).toBe("locked");
    expect(views.find((v) => v.id === "draft")).toBeUndefined();
  });
});
