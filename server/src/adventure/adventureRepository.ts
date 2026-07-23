import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { AdventureChapterStatus } from "./adventureRules.js";
import type { SeedChapter } from "./adventureSeed.js";

export type Queryable = { query: PoolClient["query"] };

export type AdventureChapterRow = {
  id: string;
  spaceId: string;
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
  rewardType: string;
  mapThemeKey: string | null;
  status: AdventureChapterStatus;
};

export type AdventureProgressRow = {
  spaceId: string;
  highestUnlockedOrder: number;
  updatedAt: string;
};

type ChapterDbRow = {
  id: string;
  space_id: string;
  sort_order: number;
  title: string;
  subtitle: string | null;
  story_text: string;
  threshold_lifetime_xp: number;
  badge_name: string;
  badge_description: string | null;
  badge_emoji: string | null;
  badge_image_key: string | null;
  node_image_key: string | null;
  background_image_key: string | null;
  reward_type: string;
  map_theme_key: string | null;
  status: AdventureChapterStatus;
};

function mapChapter(row: ChapterDbRow): AdventureChapterRow {
  return {
    id: row.id,
    spaceId: row.space_id,
    sortOrder: row.sort_order,
    title: row.title,
    subtitle: row.subtitle,
    storyText: row.story_text,
    thresholdLifetimeXp: row.threshold_lifetime_xp,
    badgeName: row.badge_name,
    badgeDescription: row.badge_description,
    badgeEmoji: row.badge_emoji,
    badgeImageKey: row.badge_image_key,
    nodeImageKey: row.node_image_key,
    backgroundImageKey: row.background_image_key,
    rewardType: row.reward_type,
    mapThemeKey: row.map_theme_key,
    status: row.status
  };
}

export async function countChapters(client: Queryable, spaceId: string): Promise<number> {
  const { rows } = await client.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM adventure_chapters WHERE space_id = $1",
    [spaceId]
  );
  return Number(rows[0]?.count ?? 0);
}

export async function listChapters(client: Queryable, spaceId: string): Promise<AdventureChapterRow[]> {
  const { rows } = await client.query<ChapterDbRow>(
    `SELECT id, space_id, sort_order, title, subtitle, story_text, threshold_lifetime_xp,
            badge_name, badge_description, badge_emoji, badge_image_key, node_image_key, background_image_key, reward_type, map_theme_key, status
     FROM adventure_chapters
     WHERE space_id = $1
     ORDER BY sort_order ASC`,
    [spaceId]
  );
  return rows.map(mapChapter);
}

export async function insertSeedChapters(
  client: Queryable,
  spaceId: string,
  seeds: SeedChapter[]
): Promise<void> {
  for (const seed of seeds) {
    await client.query(
      `INSERT INTO adventure_chapters (
         id, space_id, sort_order, title, subtitle, story_text, threshold_lifetime_xp,
         badge_name, badge_description, badge_emoji, reward_type, map_theme_key, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'badge_story',$11,'published')`,
      [
        randomUUID(),
        spaceId,
        seed.sortOrder,
        seed.title,
        seed.subtitle,
        seed.storyText,
        seed.thresholdLifetimeXp,
        seed.badgeName,
        seed.badgeDescription,
        seed.badgeEmoji,
        seed.mapThemeKey
      ]
    );
  }
}

export async function ensureProgress(client: Queryable, spaceId: string): Promise<void> {
  await client.query(
    `INSERT INTO adventure_progress (space_id, highest_unlocked_order, updated_at)
     VALUES ($1, 0, now())
     ON CONFLICT (space_id) DO NOTHING`,
    [spaceId]
  );
}

export async function getProgress(client: Queryable, spaceId: string): Promise<AdventureProgressRow> {
  await ensureProgress(client, spaceId);
  const { rows } = await client.query<{
    space_id: string;
    highest_unlocked_order: number;
    updated_at: string;
  }>(
    `SELECT space_id, highest_unlocked_order, updated_at
     FROM adventure_progress WHERE space_id = $1`,
    [spaceId]
  );
  const row = rows[0];
  return {
    spaceId: row.space_id,
    highestUnlockedOrder: row.highest_unlocked_order,
    updatedAt: row.updated_at
  };
}

export async function setHighestUnlockedOrder(
  client: Queryable,
  spaceId: string,
  order: number
): Promise<void> {
  await client.query(
    `UPDATE adventure_progress
     SET highest_unlocked_order = $2, updated_at = now()
     WHERE space_id = $1`,
    [spaceId, order]
  );
}

export async function listClaimedChapterIds(client: Queryable, spaceId: string): Promise<string[]> {
  const { rows } = await client.query<{ chapter_id: string }>(
    "SELECT chapter_id FROM adventure_claims WHERE space_id = $1",
    [spaceId]
  );
  return rows.map((row) => row.chapter_id);
}

export async function insertClaim(
  client: Queryable,
  input: { id: string; spaceId: string; chapterId: string; claimedBy: string | null }
): Promise<"inserted" | "exists"> {
  const result = await client.query(
    `INSERT INTO adventure_claims (id, space_id, chapter_id, claimed_at, claimed_by)
     VALUES ($1, $2, $3, now(), $4)
     ON CONFLICT (space_id, chapter_id) DO NOTHING
     RETURNING id`,
    [input.id, input.spaceId, input.chapterId, input.claimedBy]
  );
  return result.rows.length > 0 ? "inserted" : "exists";
}

export async function getLifetimeEarned(client: Queryable, spaceId: string): Promise<number> {
  await client.query(
    `INSERT INTO xp_wallet (space_id, balance, lifetime_earned, lifetime_spent, updated_at)
     VALUES ($1, 0, 0, 0, now())
     ON CONFLICT (space_id) DO NOTHING`,
    [spaceId]
  );
  const { rows } = await client.query<{ lifetime_earned: number }>(
    "SELECT lifetime_earned FROM xp_wallet WHERE space_id = $1",
    [spaceId]
  );
  return Number(rows[0]?.lifetime_earned ?? 0);
}

export async function getChapterById(
  client: Queryable,
  spaceId: string,
  chapterId: string
): Promise<AdventureChapterRow | null> {
  const { rows } = await client.query<ChapterDbRow>(
    `SELECT id, space_id, sort_order, title, subtitle, story_text, threshold_lifetime_xp,
            badge_name, badge_description, badge_emoji, badge_image_key, node_image_key, background_image_key, reward_type, map_theme_key, status
     FROM adventure_chapters
     WHERE space_id = $1 AND id = $2`,
    [spaceId, chapterId]
  );
  return rows[0] ? mapChapter(rows[0]) : null;
}

export type ChapterWriteInput = {
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
  rewardType: string;
  mapThemeKey: string | null;
  status: AdventureChapterStatus;
};

export async function insertChapter(
  client: Queryable,
  spaceId: string,
  input: ChapterWriteInput
): Promise<AdventureChapterRow> {
  const id = randomUUID();
  await client.query(
    `INSERT INTO adventure_chapters (
       id, space_id, sort_order, title, subtitle, story_text, threshold_lifetime_xp,
       badge_name, badge_description, badge_emoji, badge_image_key, node_image_key,
       background_image_key, reward_type, map_theme_key, status, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, now())`,
    [
      id,
      spaceId,
      input.sortOrder,
      input.title,
      input.subtitle,
      input.storyText,
      input.thresholdLifetimeXp,
      input.badgeName,
      input.badgeDescription,
      input.badgeEmoji,
      input.badgeImageKey,
      input.nodeImageKey,
      input.backgroundImageKey,
      input.rewardType,
      input.mapThemeKey,
      input.status
    ]
  );
  const row = await getChapterById(client, spaceId, id);
  if (!row) {
    throw new Error("插入章节失败");
  }
  return row;
}

export async function updateChapter(
  client: Queryable,
  options: { spaceId: string; chapterId: string; input: ChapterWriteInput }
): Promise<AdventureChapterRow | null> {
  const { spaceId, chapterId, input } = options;
  const result = await client.query(
    `UPDATE adventure_chapters SET
       sort_order = $3,
       title = $4,
       subtitle = $5,
       story_text = $6,
       threshold_lifetime_xp = $7,
       badge_name = $8,
       badge_description = $9,
       badge_emoji = $10,
       badge_image_key = $11,
       node_image_key = $12,
       background_image_key = $13,
       reward_type = $14,
       map_theme_key = $15,
       status = $16,
       updated_at = now()
     WHERE space_id = $1 AND id = $2`,
    [
      spaceId,
      chapterId,
      input.sortOrder,
      input.title,
      input.subtitle,
      input.storyText,
      input.thresholdLifetimeXp,
      input.badgeName,
      input.badgeDescription,
      input.badgeEmoji,
      input.badgeImageKey,
      input.nodeImageKey,
      input.backgroundImageKey,
      input.rewardType,
      input.mapThemeKey,
      input.status
    ]
  );
  if (result.rowCount === 0) {
    return null;
  }
  return getChapterById(client, spaceId, chapterId);
}

export async function replaceChapterOrders(
  client: Queryable,
  spaceId: string,
  orderedIds: string[]
): Promise<void> {
  // 两阶段更新避免 UNIQUE(space_id, sort_order) 冲突
  for (let index = 0; index < orderedIds.length; index += 1) {
    await client.query(
      `UPDATE adventure_chapters
       SET sort_order = $3, updated_at = now()
       WHERE space_id = $1 AND id = $2`,
      [spaceId, orderedIds[index], -(index + 1)]
    );
  }
  for (let index = 0; index < orderedIds.length; index += 1) {
    await client.query(
      `UPDATE adventure_chapters
       SET sort_order = $3, updated_at = now()
       WHERE space_id = $1 AND id = $2`,
      [spaceId, orderedIds[index], index + 1]
    );
  }
}

export async function countClaimsForChapter(
  client: Queryable,
  spaceId: string,
  chapterId: string
): Promise<number> {
  const { rows } = await client.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM adventure_claims WHERE space_id = $1 AND chapter_id = $2",
    [spaceId, chapterId]
  );
  return Number(rows[0]?.count ?? 0);
}



export type AdventureFulfillmentStatus = "none" | "pending" | "fulfilled" | "cancelled";

export type AdventureClaimRow = {
  id: string;
  spaceId: string;
  chapterId: string;
  claimedAt: string;
  claimedBy: string | null;
  fulfillmentStatus: AdventureFulfillmentStatus;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  note: string | null;
  chapterTitle?: string;
  badgeName?: string;
  badgeEmoji?: string | null;
  badgeImageKey?: string | null;
  rewardType?: string;
};

export async function insertClaimWithFulfillment(
  client: Queryable,
  input: {
    id: string;
    spaceId: string;
    chapterId: string;
    claimedBy: string | null;
    fulfillmentStatus: AdventureFulfillmentStatus;
  }
): Promise<"inserted" | "exists"> {
  const result = await client.query(
    `INSERT INTO adventure_claims (
       id, space_id, chapter_id, claimed_at, claimed_by, fulfillment_status
     ) VALUES ($1, $2, $3, now(), $4, $5)
     ON CONFLICT (space_id, chapter_id) DO NOTHING
     RETURNING id`,
    [input.id, input.spaceId, input.chapterId, input.claimedBy, input.fulfillmentStatus]
  );
  return result.rows.length > 0 ? "inserted" : "exists";
}

export async function listClaims(client: Queryable, spaceId: string): Promise<AdventureClaimRow[]> {
  const { rows } = await client.query<{
    id: string;
    space_id: string;
    chapter_id: string;
    claimed_at: string;
    claimed_by: string | null;
    fulfillment_status: AdventureFulfillmentStatus;
    fulfilled_at: string | null;
    cancelled_at: string | null;
    note: string | null;
    chapter_title: string | null;
    badge_name: string | null;
    badge_emoji: string | null;
    badge_image_key: string | null;
    reward_type: string | null;
  }>(
    `SELECT c.id, c.space_id, c.chapter_id, c.claimed_at, c.claimed_by,
            c.fulfillment_status, c.fulfilled_at, c.cancelled_at, c.note,
            ch.title AS chapter_title, ch.badge_name, ch.badge_emoji, ch.badge_image_key,
            ch.reward_type
     FROM adventure_claims c
     JOIN adventure_chapters ch ON ch.id = c.chapter_id
     WHERE c.space_id = $1
     ORDER BY c.claimed_at DESC`,
    [spaceId]
  );
  return rows.map((row) => ({
    id: row.id,
    spaceId: row.space_id,
    chapterId: row.chapter_id,
    claimedAt: row.claimed_at,
    claimedBy: row.claimed_by,
    fulfillmentStatus: row.fulfillment_status,
    fulfilledAt: row.fulfilled_at,
    cancelledAt: row.cancelled_at,
    note: row.note,
    chapterTitle: row.chapter_title ?? undefined,
    badgeName: row.badge_name ?? undefined,
    badgeEmoji: row.badge_emoji,
    badgeImageKey: row.badge_image_key,
    rewardType: row.reward_type ?? undefined
  }));
}

export async function updateClaimFulfillment(
  client: Queryable,
  options: {
    spaceId: string;
    claimId: string;
    status: Extract<AdventureFulfillmentStatus, "fulfilled" | "cancelled">;
    note: string | null;
  }
): Promise<AdventureClaimRow | null> {
  const { spaceId, claimId, status, note } = options;
  const result = await client.query(
    status === "fulfilled"
      ? `UPDATE adventure_claims SET
           fulfillment_status = 'fulfilled',
           fulfilled_at = now(),
           cancelled_at = NULL,
           note = $3
         WHERE space_id = $1 AND id = $2
         RETURNING id`
      : `UPDATE adventure_claims SET
           fulfillment_status = 'cancelled',
           cancelled_at = now(),
           note = $3
         WHERE space_id = $1 AND id = $2
         RETURNING id`,
    [spaceId, claimId, note]
  );
  if (result.rows.length === 0) {
    return null;
  }
  const claims = await listClaims(client, spaceId);
  return claims.find((claim) => claim.id === claimId) ?? null;
}
