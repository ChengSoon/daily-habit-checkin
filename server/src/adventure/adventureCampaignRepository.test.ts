import { describe, expect, it, vi } from "vitest";
import {
  ensureAdventureCampaign,
  getAdventureCampaign
} from "./adventureCampaignRepository.js";
import {
  createAdventureStation,
  reorderAdventureStations,
  updateAdventureStation
} from "./adventureCampaignAdminRepository.js";

const DEFAULT_ROWS = [
  campaignRow("moonlight-tower", "月光灯塔", 0, 6, true),
  campaignRow("crystal-bridge", "水晶桥", 1, 14, false),
  campaignRow("star-observatory", "观星台", 2, 24, false)
];

function campaignRow(
  stationId: string | null,
  stationTitle: string | null,
  sortOrder: number | null,
  unlockAt: number | null,
  everUnlocked: boolean
) {
  return {
    campaignId: "star-coast",
    campaignTitle: "星河海岸",
    campaignSubtitle: "去月光灯塔",
    campaignVersion: 1,
    stationId,
    stationTitle,
    sortOrder,
    unlockAt,
    stationVersion: stationId ? 1 : null,
    xpEnabled: stationId !== null,
    xp: stationId === "moonlight-tower" ? 80 : stationId === "crystal-bridge" ? 100 : 120,
    badgeEnabled: stationId !== null,
    badgeTitle: stationTitle ? `${stationTitle}徽章` : null,
    badgeImageKey: null,
    badgeIcon: "ribbon",
    badgeColor: "#E9507A",
    storyEnabled: stationId !== null,
    storyTitle: stationTitle ? `${stationTitle}来信` : null,
    storyBody: stationTitle ? `${stationTitle}正文` : null,
    everUnlocked
  };
}

describe("adventureCampaignRepository", () => {
  it("seeds the default campaign once for a new space", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO adventure_campaigns")) {
          return { rows: [{ id: "star-coast" }] };
        }
        if (sql.includes("INSERT INTO adventure_stations")) {
          return { rows: [] };
        }
        if (sql.includes("FROM adventure_campaigns c")) {
          return { rows: DEFAULT_ROWS };
        }
        return { rows: [] };
      })
    };

    const campaign = await ensureAdventureCampaign(client, "space-1");

    expect(campaign.id).toBe("star-coast");
    expect(campaign.stations.map((station) => station.unlockAt)).toEqual([6, 14, 24]);
    expect(campaign.stations[0]).toMatchObject({ id: "moonlight-tower", everUnlocked: true });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO adventure_stations"), [
      "space-1"
    ]);
  });

  it("does not reseed an existing empty campaign", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO adventure_campaigns")) {
          return { rows: [] };
        }
        if (sql.includes("FROM adventure_campaigns c")) {
          return { rows: [campaignRow(null, null, null, null, false)] };
        }
        return { rows: [] };
      })
    };

    await expect(ensureAdventureCampaign(client, "space-1")).resolves.toMatchObject({ stations: [] });
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO adventure_stations"))).toBe(false);
  });

  it("returns null when a campaign does not exist", async () => {
    const client = { query: vi.fn(async () => ({ rows: [] })) };

    await expect(getAdventureCampaign(client, "space-1")).resolves.toBeNull();
  });

  it("moves future stations through temporary values before reordering", async () => {
    const rows = [
      campaignRow("future-a", "未来 A", 0, 30, false),
      campaignRow("future-b", "未来 B", 1, 36, false)
    ];
    const client = {
      query: vi.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes("INSERT INTO adventure_campaigns")) return { rows: [] };
        if (sql.includes("FROM adventure_campaigns c")) return { rows };
        if (sql.includes("UPDATE adventure_campaigns")) return { rows: [{ version: 2 }] };
        return { rows: [] };
      })
    };

    await reorderAdventureStations(client, "space-1", ["future-b", "future-a"], 1);

    expect(client.query.mock.calls.some(([sql]) =>
      String(sql).includes("sort_order = sort_order + 1000")
    )).toBe(true);
  });

  it("opens a temporary sort-order gap before inserting between stations", async () => {
    const rows = [
      campaignRow("first", "第一关", 0, 24, false),
      campaignRow("last", "最后一关", 1, 36, false)
    ];
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO adventure_campaigns")) return { rows: [] };
        if (sql.includes("FROM adventure_campaigns c")) return { rows };
        if (sql.includes("COALESCE(SUM(amount)")) return { rows: [{ total: "10" }] };
        if (sql.includes("UPDATE adventure_campaigns")) return { rows: [{ version: 2 }] };
        return { rows: [] };
      })
    };

    await createAdventureStation(client, "space-1", {
      title: "中间关卡",
      unlockAt: 30,
      xpEnabled: false,
      xp: 0,
      badgeEnabled: true,
      badgeTitle: "中间徽章",
      badgeImageKey: null,
      badgeIcon: "ribbon",
      badgeColor: "#E9507A",
      storyEnabled: false,
      storyTitle: null,
      storyBody: null,
      campaignVersion: 1
    });

    expect(client.query.mock.calls.some(([sql]) =>
      String(sql).includes("sort_order = sort_order + 1000")
    )).toBe(true);
  });

  it("uses contiguous PostgreSQL parameters when updating a station", async () => {
    const rows = [campaignRow("future-a", "未来 A", 0, 30, false)];
    const client = {
      query: vi.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes("INSERT INTO adventure_campaigns")) return { rows: [] };
        if (sql.includes("FROM adventure_campaigns c")) return { rows };
        if (sql.includes("COALESCE(SUM(amount)")) return { rows: [{ total: "10" }] };
        if (sql.includes("UPDATE adventure_campaigns")) return { rows: [{ version: 2 }] };
        return { rows: [] };
      })
    };

    await updateAdventureStation(client, "space-1", "future-a", {
      title: "更新后的未来 A",
      unlockAt: 30,
      xpEnabled: false,
      xp: 0,
      badgeEnabled: true,
      badgeTitle: "更新徽章",
      badgeImageKey: null,
      badgeIcon: "star",
      badgeColor: "#6E7BD9",
      storyEnabled: false,
      storyTitle: null,
      storyBody: null,
      campaignVersion: 1
    });

    const updateCall = client.query.mock.calls.find(([sql]) => String(sql).includes("title = $4"));
    expect(String(updateCall?.[0])).toContain("unlock_at = $5");
    expect(updateCall?.[1]).toHaveLength(15);
  });
});
