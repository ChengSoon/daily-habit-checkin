import { describe, expect, it } from "vitest";
import {
  emptyAdventureStationForm,
  getAdventureStationThresholdBounds,
  stationToFormValue,
  validateAdventureStationForm
} from "./adventureStationFormModel";
import type { AdventureCampaign, AdventureStation } from "./types";

const validForm = {
  ...emptyAdventureStationForm(),
  title: "云端花园",
  unlockAtText: "30",
  badgeEnabled: true,
  badgeTitle: "花园守望者"
};

describe("adventureStationForm", () => {
  it("converts valid form values into a station write request", () => {
    expect(
      validateAdventureStationForm(validForm, {
        previousUnlockAt: 24,
        nextUnlockAt: null,
        campaignVersion: 3
      })
    ).toMatchObject({
      title: "云端花园",
      unlockAt: 30,
      badgeEnabled: true,
      badgeTitle: "花园守望者",
      campaignVersion: 3
    });
  });

  it("rejects invalid cumulative thresholds and empty rewards", () => {
    expect(() =>
      validateAdventureStationForm({ ...validForm, unlockAtText: "24" }, {
        previousUnlockAt: 24,
        nextUnlockAt: null,
        campaignVersion: 3
      })
    ).toThrow("累计行动力必须高于 24 点");

    expect(() =>
      validateAdventureStationForm({
        ...validForm,
        xpEnabled: false,
        badgeEnabled: false,
        storyEnabled: false
      }, {
        previousUnlockAt: 24,
        nextUnlockAt: null,
        campaignVersion: 3
      })
    ).toThrow("至少选择一种关卡奖励");
  });

  it("maps an existing station into editable form values", () => {
    const station: AdventureStation = {
      id: "cloud-garden",
      title: "云端花园",
      sortOrder: 3,
      unlockAt: 30,
      version: 1,
      everUnlocked: true,
      reward: {
        xpEnabled: true,
        xp: 150,
        badgeEnabled: true,
        badgeTitle: "花园守望者",
        badgeImageKey: "adventure_badges/space-1/badge.png",
        badgeIcon: "flower",
        badgeColor: "#E9507A",
        storyEnabled: true,
        storyTitle: "云端来信",
        storyBody: "正文"
      }
    };

    expect(stationToFormValue(station)).toMatchObject({
      unlockAtText: "30",
      xpText: "150",
      badgeImageKey: "adventure_badges/space-1/badge.png",
      storyTitle: "云端来信"
    });
  });

  it("keeps future thresholds above the current cumulative progress", () => {
    const campaign: AdventureCampaign = {
      id: "star-coast",
      title: "星河海岸",
      subtitle: null,
      version: 1,
      stations: [
        { ...stationFixture(), id: "first", unlockAt: 6, sortOrder: 0 },
        { ...stationFixture(), id: "future", unlockAt: 24, sortOrder: 1, everUnlocked: false }
      ]
    };

    expect(getAdventureStationThresholdBounds(campaign, "future", 18)).toEqual({
      previousUnlockAt: 18,
      nextUnlockAt: null
    });
    expect(getAdventureStationThresholdBounds(campaign, "new", 30)).toEqual({
      previousUnlockAt: 30,
      nextUnlockAt: null
    });
    expect(getAdventureStationThresholdBounds(campaign, "first", 30)).toEqual({
      previousUnlockAt: 0,
      nextUnlockAt: 24
    });
  });
});

function stationFixture(): AdventureStation {
  return {
    id: "station",
    title: "关卡",
    sortOrder: 0,
    unlockAt: 6,
    version: 1,
    everUnlocked: true,
    reward: {
      xpEnabled: false,
      xp: 0,
      badgeEnabled: true,
      badgeTitle: "勋章",
      badgeImageKey: null,
      badgeIcon: "ribbon",
      badgeColor: "#E9507A",
      storyEnabled: false,
      storyTitle: null,
      storyBody: null
    }
  };
}
