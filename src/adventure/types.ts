export type ChapterViewStatus = "locked" | "claimable" | "claimed";
export type AdventureChapterStatus = "published" | "draft" | "archived";
export type AdventureRewardType = "badge_story" | "real_pending";
export type AdventureFulfillmentStatus = "none" | "pending" | "fulfilled" | "cancelled";

export type ChapterClaimInfo = {
  fulfillmentStatus: AdventureFulfillmentStatus;
  claimedAt: string;
  note: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
};

export type AdventureChapterView = {
  id: string;
  sortOrder: number;
  title: string;
  subtitle: string | null;
  storyText: string;
  thresholdLifetimeXp: number;
  badgeName: string;
  badgeDescription: string | null;
  badgeEmoji: string | null;
  badgeImageKey: string | null;
  nodeImageKey: string | null;
  backgroundImageKey: string | null;
  mapThemeKey: string | null;
  rewardType: string;
  viewStatus: ChapterViewStatus;
  claim: ChapterClaimInfo | null;
};

export type AdventureClaimSummary = {
  id: string;
  chapterId: string;
  chapterTitle: string;
  badgeName: string;
  badgeEmoji: string | null;
  badgeImageKey: string | null;
  rewardType: string;
  claimedAt: string;
  claimedBy: string | null;
  fulfillmentStatus: AdventureFulfillmentStatus;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  note: string | null;
};

export type AdventureState = {
  lifetimeEarned: number;
  highestUnlockedOrder: number;
  claimableCount: number;
  chapters: AdventureChapterView[];
  nextChapter: AdventureChapterView | null;
  claims: AdventureClaimSummary[];
  pendingFulfillmentCount: number;
};

export type AdminAdventureChapter = {
  id: string;
  sortOrder: number;
  title: string;
  subtitle: string | null;
  storyText: string;
  thresholdLifetimeXp: number;
  badgeName: string;
  badgeDescription: string | null;
  badgeEmoji: string | null;
  badgeImageKey: string | null;
  nodeImageKey: string | null;
  backgroundImageKey: string | null;
  mapThemeKey: string | null;
  rewardType: string;
  status: AdventureChapterStatus;
  claimCount: number;
};

export type AdventureChapterAdminInput = {
  title: string;
  subtitle?: string | null;
  storyText: string;
  thresholdLifetimeXp: number;
  badgeName: string;
  badgeDescription?: string | null;
  badgeEmoji?: string | null;
  badgeImageKey?: string | null;
  nodeImageKey?: string | null;
  backgroundImageKey?: string | null;
  mapThemeKey?: string | null;
  rewardType?: AdventureRewardType | string;
  status?: AdventureChapterStatus;
};

export type AdventureClaim = {
  id: string;
  chapterId: string;
  chapterTitle: string;
  badgeName: string;
  rewardType: string;
  claimedAt: string;
  claimedBy: string | null;
  fulfillmentStatus: AdventureFulfillmentStatus;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  note: string | null;
};
