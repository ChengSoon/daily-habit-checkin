import { describe, expect, it } from "vitest";
import type { AdventureCampaign, AdventureStation } from "./adventureRules.js";
import {
  calculateAdventurePointAwardMutations,
  calculateAdventurePointAwards,
  calculateAdventurePointRevocations,
  calculateAdventureProgress,
  getCrossedStations,
  getNextStationReward
} from "./adventureRules.js";

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
    dynamicStation("moonlight-tower", 6, 0),
    dynamicStation("crystal-bridge", 14, 1),
    dynamicStation("star-observatory", 24, 2)
  ]
};

describe("server adventure rules", () => {
  it("derives current and next station from total points", () => {
    expect(calculateAdventureProgress(DEFAULT_CAMPAIGN, 0)).toMatchObject({
      currentStationId: "start",
      nextStationId: "moonlight-tower",
      segmentPoints: 0,
      pointsToNext: 6
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

  it("creates point awards using stable unique keys", () => {
    expect(
      calculateAdventurePointAwards({
        habitId: "habit-1",
        dateKey: "2026-07-10",
        checkInId: "checkin-1",
        shouldAwardAllDone: true
      }).map((award) => award.uniqueKey)
    ).toEqual(["adventure:checkin:habit-1:2026-07-10", "adventure:all_done:2026-07-10"]);
  });

  it("restores action points with redo keys after an undo", () => {
    expect(
      calculateAdventurePointAwardMutations({
        habitId: "habit-1",
        dateKey: "2026-07-10",
        checkInId: "checkin-2",
        shouldAwardAllDone: true,
        checkInBalance: 0,
        allDoneBalance: 0,
        hasCheckInHistory: true,
        hasAllDoneHistory: true
      })
    ).toEqual([
      expect.objectContaining({
        uniqueKey: "adventure_redo:checkin:habit-1:2026-07-10:checkin-2",
        amount: 1,
        reason: "checkin"
      }),
      expect.objectContaining({
        uniqueKey: "adventure_redo:all_done:2026-07-10:checkin-2",
        amount: 1,
        reason: "all_done"
      })
    ]);
  });

  it("does not duplicate active point awards", () => {
    expect(
      calculateAdventurePointAwardMutations({
        habitId: "habit-1",
        dateKey: "2026-07-10",
        checkInId: "checkin-1",
        shouldAwardAllDone: true,
        checkInBalance: 1,
        allDoneBalance: 1,
        hasCheckInHistory: true,
        hasAllDoneHistory: true
      })
    ).toEqual([]);
  });

  it("only revokes currently active logical awards", () => {
    expect(
      calculateAdventurePointRevocations({
        habitId: "habit-1",
        dateKey: "2026-07-10",
        checkInId: "checkin-1",
        checkInBalance: 1,
        allDoneBalance: 0
      })
    ).toEqual([
      expect.objectContaining({
        uniqueKey: "adventure_undo:checkin:habit-1:2026-07-10:checkin-1",
        amount: -1,
        reason: "checkin_undo"
      })
    ]);

    expect(
      calculateAdventurePointRevocations({
        habitId: "habit-1",
        dateKey: "2026-07-10",
        checkInId: "checkin-1",
        checkInBalance: 0,
        allDoneBalance: 0
      })
    ).toEqual([]);
  });
});
