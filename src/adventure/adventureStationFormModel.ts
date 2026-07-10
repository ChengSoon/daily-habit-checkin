import type { AdventureStationWriteInput } from "./adventureAdminClient";
import type { AdventureCampaign, AdventureStation } from "./types";

export type AdventureStationFormValue = {
  title: string;
  unlockAtText: string;
  xpEnabled: boolean;
  xpText: string;
  badgeEnabled: boolean;
  badgeTitle: string;
  badgeImageKey: string | null;
  badgeIcon: string;
  badgeColor: string;
  storyEnabled: boolean;
  storyTitle: string;
  storyBody: string;
};

type FormContext = {
  previousUnlockAt: number;
  nextUnlockAt: number | null;
  campaignVersion: number;
};

export function getAdventureStationThresholdBounds(
  campaign: AdventureCampaign,
  stationId: string,
  totalPoints: number
): Pick<FormContext, "previousUnlockAt" | "nextUnlockAt"> {
  const stationIndex = campaign.stations.findIndex((station) => station.id === stationId);
  const station = stationIndex >= 0 ? campaign.stations[stationIndex] : null;
  if (!station) {
    return {
      previousUnlockAt: Math.max(campaign.stations.at(-1)?.unlockAt ?? 0, totalPoints),
      nextUnlockAt: null
    };
  }
  const previousUnlockAt = campaign.stations[stationIndex - 1]?.unlockAt ?? 0;
  return {
    previousUnlockAt: station.everUnlocked ? previousUnlockAt : Math.max(previousUnlockAt, totalPoints),
    nextUnlockAt: campaign.stations[stationIndex + 1]?.unlockAt ?? null
  };
}

export function emptyAdventureStationForm(): AdventureStationFormValue {
  return {
    title: "",
    unlockAtText: "",
    xpEnabled: false,
    xpText: "0",
    badgeEnabled: true,
    badgeTitle: "",
    badgeImageKey: null,
    badgeIcon: "ribbon",
    badgeColor: "#E9507A",
    storyEnabled: false,
    storyTitle: "",
    storyBody: ""
  };
}

export function stationToFormValue(station: AdventureStation): AdventureStationFormValue {
  return {
    title: station.title,
    unlockAtText: String(station.unlockAt),
    xpEnabled: station.reward.xpEnabled,
    xpText: String(station.reward.xp),
    badgeEnabled: station.reward.badgeEnabled,
    badgeTitle: station.reward.badgeTitle ?? "",
    badgeImageKey: station.reward.badgeImageKey,
    badgeIcon: station.reward.badgeIcon ?? "ribbon",
    badgeColor: station.reward.badgeColor ?? "#E9507A",
    storyEnabled: station.reward.storyEnabled,
    storyTitle: station.reward.storyTitle ?? "",
    storyBody: station.reward.storyBody ?? ""
  };
}

function requireText(value: string, message: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(message);
  return trimmed;
}

export function validateAdventureStationForm(
  value: AdventureStationFormValue,
  context: FormContext
): AdventureStationWriteInput {
  const title = requireText(value.title, "请填写关卡名称");
  const unlockAt = Number(value.unlockAtText);
  if (!Number.isInteger(unlockAt) || unlockAt <= context.previousUnlockAt) {
    throw new Error(`累计行动力必须高于 ${context.previousUnlockAt} 点`);
  }
  if (context.nextUnlockAt !== null && unlockAt >= context.nextUnlockAt) {
    throw new Error(`累计行动力必须低于 ${context.nextUnlockAt} 点`);
  }
  if (!value.xpEnabled && !value.badgeEnabled && !value.storyEnabled) {
    throw new Error("至少选择一种关卡奖励");
  }
  const xp = value.xpEnabled ? Number(value.xpText) : 0;
  if (!Number.isInteger(xp) || xp < 0 || xp > 1_000_000) {
    throw new Error("XP 奖励必须是 0 到 1000000 的整数");
  }

  return {
    title,
    unlockAt,
    xpEnabled: value.xpEnabled,
    xp,
    badgeEnabled: value.badgeEnabled,
    badgeTitle: value.badgeEnabled ? requireText(value.badgeTitle, "请填写勋章名称") : null,
    badgeImageKey: value.badgeEnabled ? value.badgeImageKey : null,
    badgeIcon: value.badgeEnabled ? value.badgeIcon : null,
    badgeColor: value.badgeEnabled ? value.badgeColor : null,
    storyEnabled: value.storyEnabled,
    storyTitle: value.storyEnabled ? requireText(value.storyTitle, "请填写来信标题") : null,
    storyBody: value.storyEnabled ? requireText(value.storyBody, "请填写来信正文") : null,
    campaignVersion: context.campaignVersion
  };
}
