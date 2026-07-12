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
  countClaimsForChapter,
  ensureProgress,
  getChapterById,
  getLifetimeEarned,
  getProgress,
  insertChapter,
  insertClaim,
  insertSeedChapters,
  listChapters,
  listClaimedChapterIds,
  replaceChapterOrders,
  setHighestUnlockedOrder,
  updateChapter,
  type AdventureChapterRow,
  type ChapterWriteInput,
  type Queryable
} from "./adventureRepository.js";
import type { AdventureChapterStatus } from "./adventureRules.js";
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

export type AdminChapterDto = {
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

export type ChapterAdminInput = {
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
  sortOrder?: number;
};

function toAdminDto(row: AdventureChapterRow, claimCount: number): AdminChapterDto {
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
    status: row.status,
    claimCount
  };
}

function normalizeAdminInput(raw: ChapterAdminInput, fallbackSortOrder: number): ChapterWriteInput {
  const title = raw.title.trim();
  const storyText = raw.storyText.trim();
  const badgeName = raw.badgeName.trim();
  if (!title) {
    throw Object.assign(new Error("标题不能为空"), { status: 400 });
  }
  if (!storyText) {
    throw Object.assign(new Error("叙事正文不能为空"), { status: 400 });
  }
  if (!badgeName) {
    throw Object.assign(new Error("徽章名称不能为空"), { status: 400 });
  }
  if (!Number.isFinite(raw.thresholdLifetimeXp) || raw.thresholdLifetimeXp < 0) {
    throw Object.assign(new Error("门槛 XP 必须是非负整数"), { status: 400 });
  }
  const status = raw.status ?? "published";
  if (!["published", "draft", "archived"].includes(status)) {
    throw Object.assign(new Error("状态不合法"), { status: 400 });
  }
  const sortOrder = raw.sortOrder ?? fallbackSortOrder;
  if (!Number.isInteger(sortOrder) || sortOrder < 1) {
    throw Object.assign(new Error("排序必须是从 1 开始的整数"), { status: 400 });
  }
  const rewardType = (raw.rewardType ?? "badge_story").trim() || "badge_story";
  // 阶段 2.1 仍只写 badge_story；允许 real_pending 预留，但不做兑现流
  if (!["badge_story", "real_pending"].includes(rewardType)) {
    throw Object.assign(new Error("奖励类型不合法"), { status: 400 });
  }

  return {
    sortOrder,
    title,
    subtitle: raw.subtitle?.trim() ? raw.subtitle.trim() : null,
    storyText,
    thresholdLifetimeXp: Math.trunc(raw.thresholdLifetimeXp),
    badgeName,
    badgeDescription: raw.badgeDescription?.trim() ? raw.badgeDescription.trim() : null,
    badgeEmoji: raw.badgeEmoji?.trim() ? raw.badgeEmoji.trim() : null,
    rewardType,
    mapThemeKey: raw.mapThemeKey?.trim() ? raw.mapThemeKey.trim() : null,
    status
  };
}

export async function listAdminChapters(spaceId: string): Promise<AdminChapterDto[]> {
  return withTransaction(async (client) => {
    await ensureAdventureForSpace(spaceId, client);
    const chapters = await listChapters(client, spaceId);
    const result: AdminChapterDto[] = [];
    for (const chapter of chapters) {
      const claimCount = await countClaimsForChapter(client, spaceId, chapter.id);
      result.push(toAdminDto(chapter, claimCount));
    }
    return result;
  });
}

export async function createAdminChapter(
  spaceId: string,
  raw: ChapterAdminInput
): Promise<AdminChapterDto> {
  return withTransaction(async (client) => {
    await ensureAdventureForSpace(spaceId, client);
    const chapters = await listChapters(client, spaceId);
    const nextOrder = (chapters[chapters.length - 1]?.sortOrder ?? 0) + 1;
    const input = normalizeAdminInput(raw, nextOrder);
    // 新建时默认追加到末尾，避免与现有 sort_order 冲突
    input.sortOrder = nextOrder;
    const row = await insertChapter(client, spaceId, input);
    return toAdminDto(row, 0);
  });
}

export async function updateAdminChapter(
  spaceId: string,
  chapterId: string,
  raw: ChapterAdminInput
): Promise<AdminChapterDto> {
  return withTransaction(async (client) => {
    await ensureAdventureForSpace(spaceId, client);
    const existing = await getChapterById(client, spaceId, chapterId);
    if (!existing) {
      throw Object.assign(new Error("章节不存在"), { status: 404 });
    }
    const input = normalizeAdminInput(raw, existing.sortOrder);
    // 更新时保持原排序，排序走 reorder 接口
    input.sortOrder = existing.sortOrder;
    const row = await updateChapter(client, spaceId, chapterId, input);
    if (!row) {
      throw Object.assign(new Error("章节不存在"), { status: 404 });
    }
    const claimCount = await countClaimsForChapter(client, spaceId, chapterId);
    return toAdminDto(row, claimCount);
  });
}

export async function setAdminChapterStatus(
  spaceId: string,
  chapterId: string,
  status: AdventureChapterStatus
): Promise<AdminChapterDto> {
  if (!["published", "draft", "archived"].includes(status)) {
    throw Object.assign(new Error("状态不合法"), { status: 400 });
  }
  return withTransaction(async (client) => {
    const existing = await getChapterById(client, spaceId, chapterId);
    if (!existing) {
      throw Object.assign(new Error("章节不存在"), { status: 404 });
    }
    const row = await updateChapter(client, spaceId, chapterId, {
      sortOrder: existing.sortOrder,
      title: existing.title,
      subtitle: existing.subtitle,
      storyText: existing.storyText,
      thresholdLifetimeXp: existing.thresholdLifetimeXp,
      badgeName: existing.badgeName,
      badgeDescription: existing.badgeDescription,
      badgeEmoji: existing.badgeEmoji,
      rewardType: existing.rewardType,
      mapThemeKey: existing.mapThemeKey,
      status
    });
    if (!row) {
      throw Object.assign(new Error("章节不存在"), { status: 404 });
    }
    const claimCount = await countClaimsForChapter(client, spaceId, chapterId);
    return toAdminDto(row, claimCount);
  });
}

export async function reorderAdminChapters(
  spaceId: string,
  orderedIds: string[]
): Promise<AdminChapterDto[]> {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw Object.assign(new Error("排序列表不能为空"), { status: 400 });
  }
  return withTransaction(async (client) => {
    await ensureAdventureForSpace(spaceId, client);
    const chapters = await listChapters(client, spaceId);
    if (orderedIds.length !== chapters.length) {
      throw Object.assign(new Error("排序列表必须包含全部章节"), { status: 400 });
    }
    const existingIds = new Set(chapters.map((chapter) => chapter.id));
    for (const id of orderedIds) {
      if (!existingIds.has(id)) {
        throw Object.assign(new Error("排序列表包含未知章节"), { status: 400 });
      }
    }
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw Object.assign(new Error("排序列表不能重复"), { status: 400 });
    }
    await replaceChapterOrders(client, spaceId, orderedIds);
    const next = await listChapters(client, spaceId);
    const result: AdminChapterDto[] = [];
    for (const chapter of next) {
      const claimCount = await countClaimsForChapter(client, spaceId, chapter.id);
      result.push(toAdminDto(chapter, claimCount));
    }
    return result;
  });
}
