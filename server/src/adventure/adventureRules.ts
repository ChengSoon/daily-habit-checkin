export type AdventureChapterStatus = "published" | "draft" | "archived";

export type AdventureChapterConfig = {
  id: string;
  sortOrder: number;
  thresholdLifetimeXp: number;
  status: AdventureChapterStatus;
};

export type ChapterViewStatus = "locked" | "claimable" | "claimed";

export type ChapterView = AdventureChapterConfig & {
  viewStatus: ChapterViewStatus;
};

export function publishedChapters(chapters: AdventureChapterConfig[]): AdventureChapterConfig[] {
  return chapters
    .filter((chapter) => chapter.status === "published")
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * 只增不减。从 sort_order=1 起连续解锁：
 * 当 highest 已覆盖 order-1（或 order===1）且 lifetimeEarned >= threshold 时解锁 order。
 */
export function advanceHighestUnlockedOrder(
  chapters: AdventureChapterConfig[],
  currentHighest: number,
  lifetimeEarned: number
): number {
  const list = publishedChapters(chapters);
  let highest = Math.max(0, currentHighest);

  for (const chapter of list) {
    if (chapter.sortOrder <= highest) {
      continue;
    }
    const previousOk = chapter.sortOrder === 1 || highest >= chapter.sortOrder - 1;
    if (!previousOk || lifetimeEarned < chapter.thresholdLifetimeXp) {
      break;
    }
    highest = chapter.sortOrder;
  }

  return highest;
}

export function buildChapterViews(input: {
  chapters: AdventureChapterConfig[];
  highestUnlockedOrder: number;
  claimedChapterIds: Set<string>;
  lifetimeEarned: number;
}): ChapterView[] {
  return publishedChapters(input.chapters).map((chapter) => {
    const unlocked = chapter.sortOrder <= input.highestUnlockedOrder;
    if (!unlocked) {
      return { ...chapter, viewStatus: "locked" };
    }
    if (input.claimedChapterIds.has(chapter.id)) {
      return { ...chapter, viewStatus: "claimed" };
    }
    return { ...chapter, viewStatus: "claimable" };
  });
}

export function countClaimable(views: ChapterView[]): number {
  return views.filter((view) => view.viewStatus === "claimable").length;
}
