import { describe, expect, it } from "vitest";
import { buildAdventureStateFromParts, type ChapterViewDto } from "./adventureService.js";
import type { AdventureChapterRow } from "./adventureRepository.js";

function chapter(
  partial: Pick<AdventureChapterRow, "id" | "sortOrder" | "thresholdLifetimeXp"> &
    Partial<AdventureChapterRow>
): AdventureChapterRow {
  return {
    spaceId: "space-1",
    title: partial.title ?? partial.id,
    subtitle: null,
    storyText: "story",
    badgeName: "badge",
    badgeDescription: null,
    badgeEmoji: "🏅",
    rewardType: "badge_story",
    mapThemeKey: null,
    status: "published",
    ...partial
  };
}

const chapters = [
  chapter({ id: "c1", sortOrder: 1, thresholdLifetimeXp: 50 }),
  chapter({ id: "c2", sortOrder: 2, thresholdLifetimeXp: 150 }),
  chapter({ id: "c3", sortOrder: 3, thresholdLifetimeXp: 300 })
];

function byId(stateChapters: ChapterViewDto[], id: string) {
  return stateChapters.find((item) => item.id === id);
}

describe("buildAdventureStateFromParts", () => {
  it("unlocks chapter 1 at 50 XP as claimable", () => {
    const state = buildAdventureStateFromParts({
      lifetimeEarned: 50,
      highestUnlockedOrder: 0,
      chapters,
      claimedChapterIds: []
    });
    expect(state.highestUnlockedOrder).toBe(1);
    expect(byId(state.chapters, "c1")?.viewStatus).toBe("claimable");
    expect(state.claimableCount).toBe(1);
  });

  it("marks claimed chapters and reduces claimable count", () => {
    const state = buildAdventureStateFromParts({
      lifetimeEarned: 50,
      highestUnlockedOrder: 1,
      chapters,
      claimedChapterIds: ["c1"]
    });
    expect(byId(state.chapters, "c1")?.viewStatus).toBe("claimed");
    expect(state.claimableCount).toBe(0);
  });

  it("advances through full linear prefix when XP is high", () => {
    const state = buildAdventureStateFromParts({
      lifetimeEarned: 999,
      highestUnlockedOrder: 0,
      chapters,
      claimedChapterIds: []
    });
    expect(state.highestUnlockedOrder).toBe(3);
    expect(state.claimableCount).toBe(3);
  });

  it("does not decrease highest when lifetime drops", () => {
    const state = buildAdventureStateFromParts({
      lifetimeEarned: 0,
      highestUnlockedOrder: 3,
      chapters,
      claimedChapterIds: ["c1"]
    });
    expect(state.highestUnlockedOrder).toBe(3);
    expect(byId(state.chapters, "c2")?.viewStatus).toBe("claimable");
  });
});
