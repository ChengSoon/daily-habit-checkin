import { describe, expect, it } from "vitest";
import { buildBadgeWallItems, selectPendingClaims, shouldPlayUnlockFeedback } from "./badgeWall";
import type { AdventureState } from "./types";

function state(
  partial: Partial<AdventureState> & Pick<AdventureState, "chapters" | "claims">
): AdventureState {
  return {
    lifetimeEarned: 100,
    highestUnlockedOrder: 1,
    claimableCount: 0,
    nextChapter: null,
    pendingFulfillmentCount: 0,
    ...partial
  };
}

describe("buildBadgeWallItems", () => {
  it("orders by sortOrder and marks claimed vs unclaimed", () => {
    const items = buildBadgeWallItems(
      state({
        chapters: [
          {
            id: "c2",
            sortOrder: 2,
            title: "二",
            subtitle: null,
            storyText: "",
            thresholdLifetimeXp: 150,
            badgeName: "B2",
            badgeDescription: null,
            badgeEmoji: "2️⃣",
            badgeImageKey: null,
            nodeImageKey: null,
            backgroundImageKey: null,
            mapThemeKey: null,
            rewardType: "badge_story",
            viewStatus: "locked",
            claim: null
          },
          {
            id: "c1",
            sortOrder: 1,
            title: "一",
            subtitle: null,
            storyText: "",
            thresholdLifetimeXp: 50,
            badgeName: "B1",
            badgeDescription: null,
            badgeEmoji: "1️⃣",
            badgeImageKey: null,
            nodeImageKey: null,
            backgroundImageKey: null,
            mapThemeKey: null,
            rewardType: "real_pending",
            viewStatus: "claimed",
            claim: {
              fulfillmentStatus: "pending",
              claimedAt: "2026-07-13T00:00:00.000Z",
              note: null,
              fulfilledAt: null,
              cancelledAt: null
            }
          }
        ],
        claims: []
      })
    );
    expect(items.map((item) => item.chapterId)).toEqual(["c1", "c2"]);
    expect(items[0]).toMatchObject({
      kind: "claimed",
      fulfillmentStatus: "pending",
      badgeName: "B1"
    });
    expect(items[1].kind).toBe("unclaimed");
  });
});

describe("selectPendingClaims", () => {
  it("filters pending only", () => {
    const pending = selectPendingClaims(
      state({
        chapters: [],
        claims: [
          {
            id: "1",
            chapterId: "c1",
            chapterTitle: "一",
            badgeName: "B",
            badgeEmoji: null,
            badgeImageKey: null,
            rewardType: "real_pending",
            claimedAt: "t",
            claimedBy: null,
            fulfillmentStatus: "pending",
            fulfilledAt: null,
            cancelledAt: null,
            note: null
          },
          {
            id: "2",
            chapterId: "c2",
            chapterTitle: "二",
            badgeName: "B2",
            badgeEmoji: null,
            badgeImageKey: null,
            rewardType: "real_pending",
            claimedAt: "t",
            claimedBy: null,
            fulfillmentStatus: "fulfilled",
            fulfilledAt: "t2",
            cancelledAt: null,
            note: null
          }
        ]
      })
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe("1");
  });
});

describe("shouldPlayUnlockFeedback", () => {
  it("plays only when highest increases", () => {
    expect(shouldPlayUnlockFeedback(2, null)).toBe(true);
    expect(shouldPlayUnlockFeedback(2, 1)).toBe(true);
    expect(shouldPlayUnlockFeedback(2, 2)).toBe(false);
    expect(shouldPlayUnlockFeedback(1, 2)).toBe(false);
  });
});
