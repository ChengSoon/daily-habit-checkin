import type { AdventureCampaign, AdventureStation } from "./adventureRules.js";

type QueryClient = {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
};

type CampaignRow = {
  campaignId: string;
  campaignTitle: string;
  campaignSubtitle: string | null;
  campaignVersion: number | string;
  stationId: string | null;
  stationTitle: string | null;
  sortOrder: number | string | null;
  unlockAt: number | string | null;
  stationVersion: number | string | null;
  xpEnabled: boolean | null;
  xp: number | string | null;
  badgeEnabled: boolean | null;
  badgeTitle: string | null;
  badgeImageKey: string | null;
  badgeIcon: string | null;
  badgeColor: string | null;
  storyEnabled: boolean | null;
  storyTitle: string | null;
  storyBody: string | null;
  everUnlocked: boolean | null;
};

const DEFAULT_CAMPAIGN_ID = "star-coast";

function stationFromRow(row: CampaignRow): AdventureStation | null {
  if (!row.stationId || !row.stationTitle || row.sortOrder === null || row.unlockAt === null) return null;
  return {
    id: row.stationId,
    title: row.stationTitle,
    sortOrder: Number(row.sortOrder),
    unlockAt: Number(row.unlockAt),
    version: Number(row.stationVersion ?? 1),
    everUnlocked: row.everUnlocked === true,
    reward: {
      xpEnabled: row.xpEnabled === true,
      xp: Number(row.xp ?? 0),
      badgeEnabled: row.badgeEnabled === true,
      badgeTitle: row.badgeTitle,
      badgeImageKey: row.badgeImageKey,
      badgeIcon: row.badgeIcon,
      badgeColor: row.badgeColor,
      storyEnabled: row.storyEnabled === true,
      storyTitle: row.storyTitle,
      storyBody: row.storyBody
    }
  };
}

function campaignFromRows(rows: CampaignRow[]): AdventureCampaign | null {
  const first = rows[0];
  if (!first) return null;
  return {
    id: first.campaignId,
    title: first.campaignTitle,
    subtitle: first.campaignSubtitle,
    version: Number(first.campaignVersion),
    stations: rows.flatMap((row) => {
      const station = stationFromRow(row);
      return station ? [station] : [];
    })
  };
}

export async function getAdventureCampaign(
  client: QueryClient,
  spaceId: string,
  options: { forUpdate?: boolean } = {}
): Promise<AdventureCampaign | null> {
  const lockClause = options.forUpdate ? " FOR UPDATE OF c" : "";
  const { rows } = await client.query(
    `SELECT c.id AS "campaignId", c.title AS "campaignTitle",
            c.subtitle AS "campaignSubtitle", c.version AS "campaignVersion",
            s.id AS "stationId", s.title AS "stationTitle",
            s.sort_order AS "sortOrder", s.unlock_at AS "unlockAt",
            s.version AS "stationVersion", s.xp_enabled AS "xpEnabled",
            s.xp_amount AS xp, s.badge_enabled AS "badgeEnabled",
            s.badge_title AS "badgeTitle", s.badge_image_key AS "badgeImageKey",
            s.badge_icon AS "badgeIcon", s.badge_color AS "badgeColor",
            s.story_enabled AS "storyEnabled", s.story_title AS "storyTitle",
            s.story_body AS "storyBody",
            EXISTS (SELECT 1 FROM adventure_station_rewards r
              WHERE r.space_id = c.space_id AND r.station_id = s.id) AS "everUnlocked"
     FROM adventure_campaigns c
     LEFT JOIN adventure_stations s ON s.space_id = c.space_id AND s.campaign_id = c.id
     WHERE c.space_id = $1 ORDER BY s.sort_order ASC${lockClause}`,
    [spaceId]
  );
  return campaignFromRows(rows as CampaignRow[]);
}

async function seedDefaultStations(client: QueryClient, spaceId: string) {
  await client.query(
    `INSERT INTO adventure_stations (
       space_id, campaign_id, id, title, sort_order, unlock_at,
       xp_enabled, xp_amount, badge_enabled, badge_title,
       badge_image_key, badge_icon, badge_color, story_enabled, story_title, story_body
     ) VALUES
       ($1, '${DEFAULT_CAMPAIGN_ID}', 'moonlight-tower', '月光灯塔', 0, 6,
        true, 80, true, '灯塔徽章', NULL, 'ribbon', '#E9507A', true, '灯塔来信', '灯塔记录了共同坚持的每一天。'),
       ($1, '${DEFAULT_CAMPAIGN_ID}', 'crystal-bridge', '水晶桥', 1, 14,
        true, 100, true, '水晶桥徽章', NULL, 'diamond', '#6E7BD9', true, '星河来信', '每一次完成都在搭起共同的桥。'),
       ($1, '${DEFAULT_CAMPAIGN_ID}', 'star-observatory', '观星台', 2, 24,
        true, 120, true, '观星台徽章', NULL, 'star', '#D39B34', true, '观星台回忆', '共同走过的轨迹会成为新的起点。')
     ON CONFLICT (space_id, id) DO NOTHING`,
    [spaceId]
  );
}

export async function ensureAdventureCampaign(client: QueryClient, spaceId: string): Promise<AdventureCampaign> {
  const inserted = await client.query(
    `INSERT INTO adventure_campaigns (space_id, id, title, subtitle)
     VALUES ($1, '${DEFAULT_CAMPAIGN_ID}', '星河海岸', '去月光灯塔')
     ON CONFLICT (space_id) DO NOTHING RETURNING id`,
    [spaceId]
  );
  if (inserted.rows.length > 0) await seedDefaultStations(client, spaceId);
  const campaign = await getAdventureCampaign(client, spaceId);
  if (!campaign) throw new Error("冒险路线初始化失败");
  return campaign;
}
