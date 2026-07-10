import type { AdventureStation } from "./adventureRules.js";
import { isAdventureBadgeKeyForSpace } from "../r2/r2Client.js";

export type AdventureStationWriteInput = {
  title: string;
  unlockAt: number;
  xpEnabled: boolean;
  xp: number;
  badgeEnabled: boolean;
  badgeTitle: string | null;
  badgeImageKey: string | null;
  badgeIcon: string | null;
  badgeColor: string | null;
  storyEnabled: boolean;
  storyTitle: string | null;
  storyBody: string | null;
  campaignVersion: number;
};

type StationValidationContext = {
  previousUnlockAt: number;
  nextUnlockAt: number | null;
  totalPoints: number;
  allowReachedThreshold?: boolean;
};

export class AdventureAdminError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
    this.name = "AdventureAdminError";
  }
}

function requireText(value: string | null, message: string): void {
  if (!value?.trim()) throw new AdventureAdminError(message);
}

export function validateStationInput(
  input: AdventureStationWriteInput,
  context: StationValidationContext
): AdventureStationWriteInput {
  requireText(input.title, "请填写关卡名称");
  if (!Number.isInteger(input.unlockAt) || input.unlockAt <= context.previousUnlockAt) {
    throw new AdventureAdminError("累计行动力必须高于上一关");
  }
  if (context.nextUnlockAt !== null && input.unlockAt >= context.nextUnlockAt) {
    throw new AdventureAdminError("累计行动力必须低于下一关");
  }
  if (!context.allowReachedThreshold && input.unlockAt <= context.totalPoints) {
    throw new AdventureAdminError("累计行动力必须高于当前累计行动力");
  }
  if (!input.xpEnabled && !input.badgeEnabled && !input.storyEnabled) {
    throw new AdventureAdminError("至少选择一种关卡奖励");
  }
  if (input.xpEnabled && (!Number.isInteger(input.xp) || input.xp < 0 || input.xp > 1_000_000)) {
    throw new AdventureAdminError("XP 奖励必须是 0 到 1000000 的整数");
  }
  if (input.badgeEnabled) requireText(input.badgeTitle, "请填写勋章名称");
  if (input.storyEnabled) {
    requireText(input.storyTitle, "请填写来信标题");
    requireText(input.storyBody, "请填写来信正文");
  }
  return input;
}

export function assertUnlockedStationUpdateAllowed(
  before: AdventureStation,
  input: AdventureStationWriteInput
): void {
  if (!before.everUnlocked) return;
  if (before.unlockAt !== input.unlockAt) {
    throw new AdventureAdminError("已解锁关卡不能修改行动力门槛", 409);
  }
  if (before.reward.xpEnabled !== input.xpEnabled || before.reward.xp !== input.xp) {
    throw new AdventureAdminError("已解锁关卡不能修改 XP 奖励", 409);
  }
  if (
    before.reward.badgeEnabled !== input.badgeEnabled ||
    before.reward.storyEnabled !== input.storyEnabled
  ) {
    throw new AdventureAdminError("已解锁关卡不能关闭或开启奖励", 409);
  }
}

export function assertStationCanDelete(station: AdventureStation): void {
  if (station.everUnlocked) {
    throw new AdventureAdminError("已解锁关卡不能删除", 409);
  }
}

export function assertStationBadgeImageKey(key: string | null, spaceId: string): void {
  if (key && !isAdventureBadgeKeyForSpace(key, spaceId)) {
    throw new AdventureAdminError("勋章图片不属于当前空间");
  }
}
