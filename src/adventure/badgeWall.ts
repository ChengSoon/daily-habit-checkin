import type {
  AdventureClaimSummary,
  AdventureFulfillmentStatus,
  AdventureState,
  ChapterViewStatus
} from "./types";

export type BadgeWallItem = {
  chapterId: string;
  sortOrder: number;
  chapterTitle: string;
  badgeName: string;
  badgeEmoji: string | null;
  badgeImageKey: string | null;
  kind: "claimed" | "unclaimed";
  viewStatus: ChapterViewStatus;
  fulfillmentStatus: AdventureFulfillmentStatus | null;
  rewardType: string;
};

export function buildBadgeWallItems(state: AdventureState): BadgeWallItem[] {
  return [...state.chapters]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((chapter) => ({
      chapterId: chapter.id,
      sortOrder: chapter.sortOrder,
      chapterTitle: chapter.title,
      badgeName: chapter.badgeName,
      badgeEmoji: chapter.badgeEmoji,
      badgeImageKey: chapter.badgeImageKey,
      kind: chapter.viewStatus === "claimed" ? "claimed" : "unclaimed",
      viewStatus: chapter.viewStatus,
      fulfillmentStatus: chapter.claim?.fulfillmentStatus ?? null,
      rewardType: chapter.rewardType
    }));
}

export function selectPendingClaims(state: AdventureState): AdventureClaimSummary[] {
  return state.claims.filter((claim) => claim.fulfillmentStatus === "pending");
}

export function shouldPlayUnlockFeedback(
  highestUnlockedOrder: number,
  lastSeen: number | null
): boolean {
  if (lastSeen === null) {
    return highestUnlockedOrder > 0;
  }
  return highestUnlockedOrder > lastSeen;
}

export function fulfillmentLabel(status: AdventureFulfillmentStatus | null | undefined): string | null {
  if (status === "pending") return "待兑现";
  if (status === "fulfilled") return "已兑现";
  if (status === "cancelled") return "已取消";
  return null;
}

export function fulfillmentTone(
  status: AdventureFulfillmentStatus | null | undefined
): "primary" | "success" | "danger" | "muted" {
  if (status === "pending") return "primary";
  if (status === "fulfilled") return "success";
  if (status === "cancelled") return "danger";
  return "muted";
}
