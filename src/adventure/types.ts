export type ChapterViewStatus = "locked" | "claimable" | "claimed";
export type AdventureChapterStatus = "published" | "draft" | "archived";

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
  mapThemeKey: string | null;
  rewardType: string;
  viewStatus: ChapterViewStatus;
};

export type AdventureState = {
  lifetimeEarned: number;
  highestUnlockedOrder: number;
  claimableCount: number;
  chapters: AdventureChapterView[];
  nextChapter: AdventureChapterView | null;
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
  mapThemeKey?: string | null;
  rewardType?: string;
  status?: AdventureChapterStatus;
};
