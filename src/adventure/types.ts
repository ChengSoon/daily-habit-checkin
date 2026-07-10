export type AdventureReward = {
  xpEnabled: boolean;
  xp: number;
  badgeEnabled: boolean;
  badgeTitle: string | null;
  badgeImageKey: string | null;
  badgeIcon: string | null;
  badgeColor: string | null;
  storyEnabled: boolean;
  storyTitle: string | null;
  storyBody: string | null;
};

export type AdventureStation = {
  id: string;
  title: string;
  sortOrder: number;
  unlockAt: number;
  version: number;
  everUnlocked: boolean;
  reward: AdventureReward;
};

export type AdventureCampaign = {
  id: string;
  title: string;
  subtitle: string | null;
  version: number;
  stations: AdventureStation[];
};

export type AdventureProgress = {
  campaignId: string;
  chapterId: string;
  totalPoints: number;
  currentStationId: string;
  nextStationId: string | null;
  segmentPoints: number;
  segmentCost: number;
  pointsToNext: number;
  stationIndex: number;
  stationCount: number;
  chapterIndexLabel: string;
};

export type AdventurePointReason = "checkin" | "all_done" | "checkin_undo" | "all_done_undo";

export type AdventurePointAward = {
  uniqueKey: string;
  amount: number;
  reason: AdventurePointReason;
  habitId: string | null;
  checkInId: string | null;
  dateKey: string;
};

export type AdventureStationRewardEvent = {
  stationId: string;
  reward: AdventureReward;
};

export type AdventureUnlockSummary = {
  totalPoints: number;
  totalCampaignCost: number;
  unlockedCount: number;
  unlockableCount: number;
  nextUnlockAt: number | null;
  pointsToNext: number;
  nextStationTitle: string | null;
};

export type AdventureCollectionItem = AdventureReward & {
  stationId: string;
  stationTitle: string;
  requiredPoints: number;
  isUnlocked: boolean;
};
