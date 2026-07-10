import { describe, expect, it } from "vitest";
import type { AdventureStation } from "./adventureRules.js";
import {
  assertStationCanDelete,
  assertStationBadgeImageKey,
  assertUnlockedStationUpdateAllowed,
  validateStationInput,
  type AdventureStationWriteInput
} from "./adventureAdminService.js";

const INPUT: AdventureStationWriteInput = {
  title: "云端花园",
  unlockAt: 30,
  xpEnabled: true,
  xp: 150,
  badgeEnabled: true,
  badgeTitle: "花园守望者",
  badgeImageKey: null,
  badgeIcon: "flower",
  badgeColor: "#E9507A",
  storyEnabled: false,
  storyTitle: null,
  storyBody: null,
  campaignVersion: 1
};

function unlockedStation(): AdventureStation {
  return {
    id: "cloud-garden",
    title: INPUT.title,
    sortOrder: 3,
    unlockAt: INPUT.unlockAt,
    version: 1,
    everUnlocked: true,
    reward: {
      xpEnabled: INPUT.xpEnabled,
      xp: INPUT.xp,
      badgeEnabled: INPUT.badgeEnabled,
      badgeTitle: INPUT.badgeTitle,
      badgeImageKey: INPUT.badgeImageKey,
      badgeIcon: INPUT.badgeIcon,
      badgeColor: INPUT.badgeColor,
      storyEnabled: INPUT.storyEnabled,
      storyTitle: INPUT.storyTitle,
      storyBody: INPUT.storyBody
    }
  };
}

describe("adventureAdminService", () => {
  it("accepts a future station with a cumulative threshold", () => {
    expect(
      validateStationInput(INPUT, { previousUnlockAt: 24, nextUnlockAt: null, totalPoints: 18 })
    ).toEqual(INPUT);
  });

  it("rejects thresholds outside the neighboring cumulative range", () => {
    expect(() =>
      validateStationInput({ ...INPUT, unlockAt: 24 }, { previousUnlockAt: 24, nextUnlockAt: null, totalPoints: 18 })
    ).toThrow("累计行动力必须高于上一关");
    expect(() =>
      validateStationInput({ ...INPUT, unlockAt: 31 }, { previousUnlockAt: 24, nextUnlockAt: 31, totalPoints: 18 })
    ).toThrow("累计行动力必须低于下一关");
  });

  it("rejects a future threshold that has already been reached", () => {
    expect(() =>
      validateStationInput(
        { ...INPUT, unlockAt: 18 },
        { previousUnlockAt: 14, nextUnlockAt: 24, totalPoints: 20 }
      )
    ).toThrow("累计行动力必须高于当前累计行动力");

    expect(() =>
      validateStationInput(
        { ...INPUT, unlockAt: 18 },
        {
          previousUnlockAt: 14,
          nextUnlockAt: 24,
          totalPoints: 20,
          allowReachedThreshold: true
        }
      )
    ).not.toThrow();
  });

  it("requires at least one complete reward", () => {
    expect(() =>
      validateStationInput(
        { ...INPUT, xpEnabled: false, badgeEnabled: false, storyEnabled: false },
        { previousUnlockAt: 24, nextUnlockAt: null, totalPoints: 18 }
      )
    ).toThrow("至少选择一种关卡奖励");
    expect(() =>
      validateStationInput(
        { ...INPUT, badgeTitle: "" },
        { previousUnlockAt: 24, nextUnlockAt: null, totalPoints: 18 }
      )
    ).toThrow("请填写勋章名称");
  });

  it("locks progress fields after a station was ever unlocked", () => {
    const before = unlockedStation();
    expect(() =>
      assertUnlockedStationUpdateAllowed(before, { ...INPUT, unlockAt: 31 })
    ).toThrow("已解锁关卡不能修改行动力门槛");
    expect(() =>
      assertUnlockedStationUpdateAllowed(before, { ...INPUT, xp: 180 })
    ).toThrow("已解锁关卡不能修改 XP 奖励");
    expect(() =>
      assertUnlockedStationUpdateAllowed(before, { ...INPUT, badgeEnabled: false })
    ).toThrow("已解锁关卡不能关闭或开启奖励");
  });

  it("allows cosmetic badge and letter changes after unlock", () => {
    const before = unlockedStation();
    expect(() =>
      assertUnlockedStationUpdateAllowed(before, {
        ...INPUT,
        title: "新的云端花园",
        badgeImageKey: "adventure_badges/space-1/custom.png",
        storyTitle: "更新后的来信",
        storyBody: "更新后的正文"
      })
    ).not.toThrow();
  });

  it("prevents deleting a station that was ever unlocked", () => {
    expect(() => assertStationCanDelete(unlockedStation())).toThrow("已解锁关卡不能删除");
    expect(() => assertStationCanDelete({ ...unlockedStation(), everUnlocked: false })).not.toThrow();
  });

  it("accepts only badge image keys owned by the current space", () => {
    expect(() =>
      assertStationBadgeImageKey("adventure_badges/space-1/custom.png", "space-1")
    ).not.toThrow();
    expect(() =>
      assertStationBadgeImageKey("adventure_badges/space-2/custom.png", "space-1")
    ).toThrow("勋章图片不属于当前空间");
  });
});
