import { randomUUID } from "node:crypto";
import {
  AdventureAdminError,
  assertStationBadgeImageKey,
  assertStationCanDelete,
  assertUnlockedStationUpdateAllowed,
  validateStationInput,
  type AdventureStationWriteInput
} from "./adventureAdminService.js";
import { ensureAdventureCampaign, getAdventureCampaign } from "./adventureCampaignRepository.js";
import type { AdventureCampaign } from "./adventureRules.js";

type QueryClient = {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
};

async function lockCampaign(client: QueryClient, spaceId: string, expectedVersion: number) {
  await ensureAdventureCampaign(client, spaceId);
  const campaign = await getAdventureCampaign(client, spaceId, { forUpdate: true });
  if (!campaign) throw new AdventureAdminError("冒险路线不存在", 404);
  if (campaign.version !== expectedVersion) {
    throw new AdventureAdminError("关卡已在另一台设备更新", 409);
  }
  return campaign;
}

async function readTotalPoints(client: QueryClient, spaceId: string): Promise<number> {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM adventure_point_transactions WHERE space_id = $1`,
    [spaceId]
  );
  return Number((rows[0] as { total?: string | number } | undefined)?.total ?? 0);
}

async function bumpCampaignVersion(client: QueryClient, spaceId: string, version: number) {
  const { rows } = await client.query(
    `UPDATE adventure_campaigns SET version = version + 1, updated_at = now()
     WHERE space_id = $1 AND version = $2 RETURNING version`,
    [spaceId, version]
  );
  if (rows.length === 0) throw new AdventureAdminError("关卡已在另一台设备更新", 409);
}

function rewardParams(input: AdventureStationWriteInput) {
  return [
    input.xpEnabled,
    input.xpEnabled ? input.xp : 0,
    input.badgeEnabled,
    input.badgeEnabled ? input.badgeTitle?.trim() ?? null : null,
    input.badgeEnabled ? input.badgeImageKey : null,
    input.badgeEnabled ? input.badgeIcon : null,
    input.badgeEnabled ? input.badgeColor : null,
    input.storyEnabled,
    input.storyEnabled ? input.storyTitle?.trim() ?? null : null,
    input.storyEnabled ? input.storyBody?.trim() ?? null : null
  ];
}

export async function createAdventureStation(
  client: QueryClient,
  spaceId: string,
  input: AdventureStationWriteInput
): Promise<AdventureCampaign> {
  const campaign = await lockCampaign(client, spaceId, input.campaignVersion);
  assertStationBadgeImageKey(input.badgeImageKey, spaceId);
  const totalPoints = await readTotalPoints(client, spaceId);
  const foundIndex = campaign.stations.findIndex((station) => station.unlockAt > input.unlockAt);
  const sortOrder = foundIndex < 0 ? campaign.stations.length : foundIndex;
  const previous = campaign.stations[sortOrder - 1]?.unlockAt ?? 0;
  const next = campaign.stations[sortOrder]?.unlockAt ?? null;
  validateStationInput(input, { previousUnlockAt: Math.max(previous, totalPoints), nextUnlockAt: next, totalPoints });
  if (sortOrder < campaign.stations.length) await openSortGap(client, spaceId, campaign.id, sortOrder);
  await client.query(
    `INSERT INTO adventure_stations (
       space_id, campaign_id, id, title, sort_order, unlock_at,
       xp_enabled, xp_amount, badge_enabled, badge_title, badge_image_key,
       badge_icon, badge_color, story_enabled, story_title, story_body
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [spaceId, campaign.id, randomUUID(), input.title.trim(), sortOrder, input.unlockAt, ...rewardParams(input)]
  );
  if (sortOrder < campaign.stations.length) await closeSortGap(client, spaceId, campaign.id, sortOrder);
  await bumpCampaignVersion(client, spaceId, campaign.version);
  return (await getAdventureCampaign(client, spaceId))!;
}

async function openSortGap(client: QueryClient, spaceId: string, campaignId: string, sortOrder: number) {
  await client.query(
    `UPDATE adventure_stations SET sort_order = sort_order + 1000
     WHERE space_id = $1 AND campaign_id = $2 AND sort_order >= $3`,
    [spaceId, campaignId, sortOrder]
  );
}

async function closeSortGap(client: QueryClient, spaceId: string, campaignId: string, sortOrder: number) {
  await client.query(
    `UPDATE adventure_stations SET sort_order = sort_order - 999
     WHERE space_id = $1 AND campaign_id = $2 AND sort_order >= $3`,
    [spaceId, campaignId, sortOrder + 1000]
  );
}

export async function updateAdventureStation(
  client: QueryClient,
  spaceId: string,
  stationId: string,
  input: AdventureStationWriteInput
): Promise<{ campaign: AdventureCampaign; replacedImageKey: string | null }> {
  const campaign = await lockCampaign(client, spaceId, input.campaignVersion);
  assertStationBadgeImageKey(input.badgeImageKey, spaceId);
  const stationIndex = campaign.stations.findIndex((station) => station.id === stationId);
  const station = campaign.stations[stationIndex];
  if (!station) throw new AdventureAdminError("关卡不存在", 404);
  assertUnlockedStationUpdateAllowed(station, input);
  const replacedImageKey = station.reward.badgeImageKey && station.reward.badgeImageKey !== input.badgeImageKey
    ? station.reward.badgeImageKey : null;
  validateStationInput(input, {
    previousUnlockAt: campaign.stations[stationIndex - 1]?.unlockAt ?? 0,
    nextUnlockAt: campaign.stations[stationIndex + 1]?.unlockAt ?? null,
    totalPoints: await readTotalPoints(client, spaceId),
    allowReachedThreshold: station.everUnlocked
  });
  await client.query(
    `UPDATE adventure_stations SET
       title = $4, unlock_at = $5, xp_enabled = $6, xp_amount = $7,
       badge_enabled = $8, badge_title = $9, badge_image_key = $10,
       badge_icon = $11, badge_color = $12, story_enabled = $13,
       story_title = $14, story_body = $15, version = version + 1, updated_at = now()
     WHERE space_id = $1 AND campaign_id = $2 AND id = $3`,
    [spaceId, campaign.id, stationId, input.title.trim(), input.unlockAt, ...rewardParams(input)]
  );
  await bumpCampaignVersion(client, spaceId, campaign.version);
  return { campaign: (await getAdventureCampaign(client, spaceId))!, replacedImageKey };
}

export async function deleteAdventureStation(
  client: QueryClient,
  spaceId: string,
  stationId: string,
  campaignVersion: number
): Promise<string | null> {
  const campaign = await lockCampaign(client, spaceId, campaignVersion);
  const station = campaign.stations.find((item) => item.id === stationId);
  if (!station) throw new AdventureAdminError("关卡不存在", 404);
  assertStationCanDelete(station);
  await client.query(
    `DELETE FROM adventure_stations WHERE space_id = $1 AND campaign_id = $2 AND id = $3`,
    [spaceId, campaign.id, stationId]
  );
  await client.query(
    `UPDATE adventure_stations SET sort_order = sort_order - 1
     WHERE space_id = $1 AND campaign_id = $2 AND sort_order > $3`,
    [spaceId, campaign.id, station.sortOrder]
  );
  await bumpCampaignVersion(client, spaceId, campaign.version);
  return station.reward.badgeImageKey;
}

export async function reorderAdventureStations(
  client: QueryClient,
  spaceId: string,
  orderedStationIds: string[],
  campaignVersion: number
): Promise<AdventureCampaign> {
  const campaign = await lockCampaign(client, spaceId, campaignVersion);
  const future = campaign.stations.filter((station) => !station.everUnlocked);
  if (orderedStationIds.length !== future.length || new Set(orderedStationIds).size !== future.length) {
    throw new AdventureAdminError("关卡排序数据不完整");
  }
  if (future.some((station) => !orderedStationIds.includes(station.id))) {
    throw new AdventureAdminError("只能排序未解锁关卡", 409);
  }
  const lockedCount = campaign.stations.length - future.length;
  const thresholds = future.map((station) => station.unlockAt).sort((left, right) => left - right);
  await client.query(
    `UPDATE adventure_stations SET sort_order = sort_order + 1000, unlock_at = unlock_at + 1000000000
     WHERE space_id = $1 AND id = ANY($2)`,
    [spaceId, orderedStationIds]
  );
  for (let index = 0; index < orderedStationIds.length; index += 1) {
    await client.query(
      `UPDATE adventure_stations SET sort_order = $3, unlock_at = $4,
         version = version + 1, updated_at = now() WHERE space_id = $1 AND id = $2`,
      [spaceId, orderedStationIds[index], lockedCount + index, thresholds[index]]
    );
  }
  await bumpCampaignVersion(client, spaceId, campaign.version);
  return (await getAdventureCampaign(client, spaceId))!;
}
