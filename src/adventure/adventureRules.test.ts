import { describe, expect, it } from "vitest";
import {
  calculateAdventurePointAwards,
  calculateAdventureProgress,
  getAdventureUnlockSummary,
  getAdventureCollectionItems,
  getCrossedStations,
  getNextStationReward,
  getStationSummary
} from "./adventureRules";
import { AdventureCampaign, AdventureStation } from "./types";

function dynamicStation(id: string, unlockAt: number, sortOrder: number): AdventureStation {
  return {
    id,
    title: id,
    sortOrder,
    unlockAt,
    version: 1,
    everUnlocked: false,
    reward: {
      xpEnabled: false,
      xp: 0,
      badgeEnabled: true,
      badgeTitle: `${id}-badge`,
      badgeImageKey: null,
      badgeIcon: "ribbon",
      badgeColor: "#E9507A",
      storyEnabled: false,
      storyTitle: null,
      storyBody: null
    }
  };
}

const DYNAMIC_CAMPAIGN: AdventureCampaign = {
  id: "dynamic-route",
  title: "动态路线",
  subtitle: null,
  version: 1,
  stations: [
    dynamicStation("first", 6, 0),
    dynamicStation("second", 11, 1),
    dynamicStation("third", 12, 2)
  ]
};

const DEFAULT_CAMPAIGN: AdventureCampaign = {
  id: "star-coast",
  title: "星河海岸",
  subtitle: "去月光灯塔",
  version: 1,
  stations: [
    {
      ...dynamicStation("moonlight-tower", 6, 0),
      title: "月光灯塔",
      reward: {
        ...dynamicStation("moonlight-tower", 6, 0).reward,
        storyEnabled: true,
        badgeTitle: "灯塔徽章",
        storyTitle: "灯塔来信",
        storyBody: "正文"
      }
    },
    { ...dynamicStation("crystal-bridge", 14, 1), title: "水晶桥" },
    { ...dynamicStation("star-observatory", 24, 2), title: "观星台" }
  ]
};

describe("adventure rules", () => {
  it("derives current and next station from total points", () => {
    expect(calculateAdventureProgress(DEFAULT_CAMPAIGN, 0)).toMatchObject({
      currentStationId: "start",
      nextStationId: "moonlight-tower",
      segmentPoints: 0,
      pointsToNext: 6
    });

    expect(calculateAdventureProgress(DEFAULT_CAMPAIGN, 4)).toMatchObject({
      currentStationId: "start",
      nextStationId: "moonlight-tower",
      segmentPoints: 4,
      pointsToNext: 2
    });

    expect(calculateAdventureProgress(DEFAULT_CAMPAIGN, 6)).toMatchObject({
      currentStationId: "moonlight-tower",
      nextStationId: "crystal-bridge",
      segmentPoints: 0,
      pointsToNext: 8
    });
  });

  it("caps progress at the final station", () => {
    const progress = calculateAdventureProgress(DEFAULT_CAMPAIGN, 999);

    expect(progress.currentStationId).toBe("star-observatory");
    expect(progress.nextStationId).toBeNull();
    expect(progress.pointsToNext).toBe(0);
    expect(progress.chapterIndexLabel).toBe("第 4 / 4 站");
  });

  it("detects newly reached station reward after point gain", () => {
    expect(getNextStationReward(DEFAULT_CAMPAIGN, 5, 6)?.stationId).toBe("moonlight-tower");
    expect(getNextStationReward(DEFAULT_CAMPAIGN, 6, 7)).toBeNull();
  });

  it("derives progress from cumulative station thresholds", () => {
    expect(calculateAdventureProgress(DYNAMIC_CAMPAIGN, 11)).toMatchObject({
      currentStationId: "second",
      nextStationId: "third",
      segmentPoints: 0,
      pointsToNext: 1
    });
  });

  it("returns every station crossed by a two-point action", () => {
    expect(getCrossedStations(DYNAMIC_CAMPAIGN, 10, 12).map((station) => station.id)).toEqual([
      "second",
      "third"
    ]);
    expect(getCrossedStations(DYNAMIC_CAMPAIGN, 12, 10).map((station) => station.id)).toEqual([
      "third",
      "second"
    ]);
  });

  it("creates idempotent point awards for check-in and all-done", () => {
    expect(
      calculateAdventurePointAwards({
        habitId: "habit-1",
        dateKey: "2026-07-10",
        checkInId: "checkin-1",
        shouldAwardAllDone: true
      })
    ).toEqual([
      {
        uniqueKey: "adventure:checkin:habit-1:2026-07-10",
        amount: 1,
        reason: "checkin",
        habitId: "habit-1",
        checkInId: "checkin-1",
        dateKey: "2026-07-10"
      },
      {
        uniqueKey: "adventure:all_done:2026-07-10",
        amount: 1,
        reason: "all_done",
        habitId: null,
        checkInId: "checkin-1",
        dateKey: "2026-07-10"
      }
    ]);
  });

  it("summarizes current route for the mobile UI", () => {
    expect(getStationSummary(DEFAULT_CAMPAIGN, 4)).toEqual({
      title: "去月光灯塔",
      subtitle: "累计行动力还差 2 点到下一站",
      actionPointLabel: "累计 4 点",
      chapterProgressLabel: "星河海岸 · 已解锁 0 / 3 关"
    });
  });

  it("summarizes cumulative unlock thresholds across days", () => {
    expect(getAdventureUnlockSummary(DEFAULT_CAMPAIGN, 7)).toEqual({
      totalPoints: 7,
      totalCampaignCost: 24,
      unlockedCount: 1,
      unlockableCount: 3,
      nextUnlockAt: 14,
      pointsToNext: 7,
      nextStationTitle: "水晶桥"
    });
  });

  it("builds badge and letter collection states from claimed stations", () => {
    expect(
      getAdventureCollectionItems(DEFAULT_CAMPAIGN, new Set(["moonlight-tower"]))
    ).toEqual([
      expect.objectContaining({
        stationId: "moonlight-tower",
        requiredPoints: 6,
        isUnlocked: true,
        badgeTitle: "灯塔徽章",
        storyTitle: "灯塔来信"
      }),
      expect.objectContaining({
        stationId: "crystal-bridge",
        requiredPoints: 14,
        isUnlocked: false
      }),
      expect.objectContaining({
        stationId: "star-observatory",
        requiredPoints: 24,
        isUnlocked: false
      })
    ]);
  });
});
