import { describe, expect, it } from "vitest";
import {
  buildAdventureStateFromParts,
  type AdventureClaimSummaryDto,
  type ChapterViewDto
} from "./adventureService.js";
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
    badgeImageKey: null,
    nodeImageKey: null,
    backgroundImageKey: null,
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

function claim(
  partial: Pick<AdventureClaimSummaryDto, "id" | "chapterId" | "fulfillmentStatus"> &
    Partial<AdventureClaimSummaryDto>
): AdventureClaimSummaryDto {
  return {
    chapterTitle: partial.chapterTitle ?? partial.chapterId,
    badgeName: partial.badgeName ?? "badge",
    badgeEmoji: partial.badgeEmoji ?? "🏅",
    badgeImageKey: partial.badgeImageKey ?? null,
    rewardType: partial.rewardType ?? "badge_story",
    claimedAt: partial.claimedAt ?? "2026-07-13T00:00:00.000Z",
    claimedBy: partial.claimedBy ?? "acc-1",
    fulfilledAt: partial.fulfilledAt ?? null,
    cancelledAt: partial.cancelledAt ?? null,
    note: partial.note ?? null,
    ...partial
  };
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

  it("includes empty claims and zero pending by default", () => {
    const state = buildAdventureStateFromParts({
      lifetimeEarned: 50,
      highestUnlockedOrder: 1,
      chapters,
      claimedChapterIds: [],
      claims: []
    });
    expect(state.claims).toEqual([]);
    expect(state.pendingFulfillmentCount).toBe(0);
    expect(byId(state.chapters, "c1")?.claim).toBeNull();
  });

  it("attaches claim summary and pending count for real_pending", () => {
    const realChapter = chapter({
      id: "c1",
      sortOrder: 1,
      thresholdLifetimeXp: 50,
      rewardType: "real_pending",
      badgeEmoji: "🎁",
      badgeImageKey: "adventure_badges/s/x.png"
    });
    const state = buildAdventureStateFromParts({
      lifetimeEarned: 50,
      highestUnlockedOrder: 1,
      chapters: [realChapter, chapters[1], chapters[2]],
      claimedChapterIds: ["c1"],
      claims: [
        claim({
          id: "cl1",
          chapterId: "c1",
          chapterTitle: "c1",
          badgeName: "badge",
          badgeEmoji: "🎁",
          badgeImageKey: "adventure_badges/s/x.png",
          rewardType: "real_pending",
          fulfillmentStatus: "pending"
        })
      ]
    });
    expect(state.pendingFulfillmentCount).toBe(1);
    expect(state.claims).toHaveLength(1);
    expect(byId(state.chapters, "c1")?.viewStatus).toBe("claimed");
    expect(byId(state.chapters, "c1")?.claim).toMatchObject({
      fulfillmentStatus: "pending",
      claimedAt: "2026-07-13T00:00:00.000Z",
      note: null
    });
  });

  it("counts only pending fulfillments", () => {
    const state = buildAdventureStateFromParts({
      lifetimeEarned: 50,
      highestUnlockedOrder: 1,
      chapters,
      claimedChapterIds: ["c1"],
      claims: [
        claim({
          id: "a",
          chapterId: "c1",
          fulfillmentStatus: "none"
        }),
        claim({
          id: "b",
          chapterId: "c2",
          chapterTitle: "c2",
          badgeName: "b2",
          badgeEmoji: null,
          rewardType: "real_pending",
          claimedAt: "2026-07-13T01:00:00.000Z",
          fulfillmentStatus: "fulfilled",
          fulfilledAt: "2026-07-13T02:00:00.000Z",
          note: "已送花"
        })
      ]
    });
    expect(state.pendingFulfillmentCount).toBe(0);
  });
});
