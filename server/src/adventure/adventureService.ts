import { randomUUID } from "node:crypto";
import { withTransaction } from "../db/pool.js";
import {
  advanceHighestUnlockedOrder,
  buildChapterViews,
  countClaimable,
  type AdventureChapterConfig,
  type ChapterView
} from "./adventureRules.js";
import {
  countChapters,
  ensureProgress,
  getLifetimeEarned,
  getProgress,
  insertClaim,
  insertSeedChapters,
  listChapters,
  listClaimedChapterIds,
  setHighestUnlockedOrder,
  type AdventureChapterRow,
  type Queryable
} from "./adventureRepository.js";
import { DEFAULT_ADVENTURE_SEED } from "./adventureSeed.js";

export type ChapterViewDto = {
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
  viewStatus: ChapterView["viewStatus"];
};

export type AdventureStateDto = {
  lifetimeEarned: number;
  highestUnlockedOrder: number;
  claimableCount: number;
  chapters: ChapterViewDto[];
  nextChapter: ChapterViewDto | null;
};

function toConfig(row: AdventureChapterRow): AdventureChapterConfig {
  return {
    id: row.id,
    sortOrder: row.sortOrder,
    thresholdLifetimeXp: row.thresholdLifetimeXp,
    status: row.status
  };
}

function toDto(row: AdventureChapterRow, viewStatus: ChapterView["viewStatus"]): ChapterViewDto {
  return {
    id: row.id,
    sortOrder: row.sortOrder,
    title: row.title,
    subtitle: row.subtitle,
    storyText: row.storyText,
    thresholdLifetimeXp: row.thresholdLifetimeXp,
    badgeName: row.badgeName,
    badgeDescription: row.badgeDescription,
    badgeEmoji: row.badgeEmoji,
    mapThemeKey: row.mapThemeKey,
    rewardType: row.rewardType,
    viewStatus
  };
}

export async function ensureAdventureForSpace(spaceId: string, client?: Queryable): Promise<void> {
  const run = async (db: Queryable) => {
    const existing = await countChapters(db, spaceId);
    if (existing === 0) {
      await insertSeedChapters(db, spaceId, DEFAULT_ADVENTURE_SEED);
    }
    await ensureProgress(db, spaceId);
  };

  if (client) {
    await run(client);
    return;
  }

  await withTransaction(async (tx) => {
    await run(tx);
  });
}

async function loadAndAdvance(client: Queryable, spaceId: string): Promise<{
  lifetimeEarned: number;
  highestUnlockedOrder: number;
  chapters: AdventureChapterRow[];
  claimedIds: Set<string>;
  views: ChapterView[];
}> {
  await ensureAdventureForSpace(spaceId, client);
  const lifetimeEarned = await getLifetimeEarned(client, spaceId);
  const progress = await getProgress(client, spaceId);
  const chapters = await listChapters(client, spaceId);
  const configs = chapters.map(toConfig);
  const nextHighest = advanceHighestUnlockedOrder(
    configs,
    progress.highestUnlockedOrder,
    lifetimeEarned
  );

  if (nextHighest !== progress.highestUnlockedOrder) {
    await setHighestUnlockedOrder(client, spaceId, nextHighest);
  }

  const claimedIds = new Set(await listClaimedChapterIds(client, spaceId));
  const views = buildChapterViews({
    chapters: configs,
    highestUnlockedOrder: nextHighest,
    claimedChapterIds: claimedIds,
    lifetimeEarned
  });

  return {
    lifetimeEarned,
    highestUnlockedOrder: nextHighest,
    chapters,
    claimedIds,
    views
  };
}

function buildState(input: {
  lifetimeEarned: number;
  highestUnlockedOrder: number;
  chapters: AdventureChapterRow[];
  views: ChapterView[];
}): AdventureStateDto {
  const byId = new Map(input.chapters.map((chapter) => [chapter.id, chapter]));
  const chapterDtos: ChapterViewDto[] = input.views.map((view) => {
    const row = byId.get(view.id);
    if (!row) {
      throw new Error(`missing chapter row ${view.id}`);
    }
    return toDto(row, view.viewStatus);
  });

  const nextChapter =
    chapterDtos.find((chapter) => chapter.viewStatus === "locked") ??
    chapterDtos.find((chapter) => chapter.viewStatus === "claimable") ??
    null;

  return {
    lifetimeEarned: input.lifetimeEarned,
    highestUnlockedOrder: input.highestUnlockedOrder,
    claimableCount: countClaimable(input.views),
    chapters: chapterDtos,
    nextChapter
  };
}

export async function advanceAdventureProgress(spaceId: string): Promise<AdventureStateDto> {
  return withTransaction(async (client) => {
    const loaded = await loadAndAdvance(client, spaceId);
    return buildState(loaded);
  });
}

export async function getAdventureState(spaceId: string): Promise<AdventureStateDto> {
  return advanceAdventureProgress(spaceId);
}

export async function claimAdventureChapter(
  spaceId: string,
  chapterId: string,
  accountId: string
): Promise<{ ok: true; state: AdventureStateDto } | { ok: false; error: string; status: number }> {
  return withTransaction(async (client) => {
    const loaded = await loadAndAdvance(client, spaceId);
    const chapter = loaded.chapters.find((item) => item.id === chapterId);
    if (!chapter || chapter.status !== "published") {
      return { ok: false, error: "章节不存在", status: 404 };
    }
    if (chapter.sortOrder > loaded.highestUnlockedOrder) {
      return { ok: false, error: "章节尚未解锁", status: 400 };
    }

    await insertClaim(client, {
      id: randomUUID(),
      spaceId,
      chapterId,
      claimedBy: accountId
    });

    const claimedIds = new Set(await listClaimedChapterIds(client, spaceId));
    const views = buildChapterViews({
      chapters: loaded.chapters.map(toConfig),
      highestUnlockedOrder: loaded.highestUnlockedOrder,
      claimedChapterIds: claimedIds,
      lifetimeEarned: loaded.lifetimeEarned
    });

    return {
      ok: true,
      state: buildState({
        lifetimeEarned: loaded.lifetimeEarned,
        highestUnlockedOrder: loaded.highestUnlockedOrder,
        chapters: loaded.chapters,
        views
      })
    };
  });
}

/** 供单测：纯状态拼装（不访问数据库） */
export function buildAdventureStateFromParts(input: {
  lifetimeEarned: number;
  highestUnlockedOrder: number;
  chapters: AdventureChapterRow[];
  claimedChapterIds: string[];
}): AdventureStateDto {
  const configs = input.chapters.map(toConfig);
  const advanced = advanceHighestUnlockedOrder(
    configs,
    input.highestUnlockedOrder,
    input.lifetimeEarned
  );
  const views = buildChapterViews({
    chapters: configs,
    highestUnlockedOrder: advanced,
    claimedChapterIds: new Set(input.claimedChapterIds),
    lifetimeEarned: input.lifetimeEarned
  });
  return buildState({
    lifetimeEarned: input.lifetimeEarned,
    highestUnlockedOrder: advanced,
    chapters: input.chapters,
    views
  });
}

