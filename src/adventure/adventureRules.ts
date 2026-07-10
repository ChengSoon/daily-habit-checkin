import {
  AdventureCampaign,
  AdventureCollectionItem,
  AdventurePointAward,
  AdventureProgress,
  AdventureStationRewardEvent,
  AdventureUnlockSummary
} from "./types";

type PointAwardInput = {
  habitId: string;
  dateKey: string;
  checkInId: string;
  shouldAwardAllDone: boolean;
};

type StationSummary = {
  title: string;
  subtitle: string;
  actionPointLabel: string;
  chapterProgressLabel: string;
};

function clampPoints(totalPoints: number): number {
  return Math.max(0, Math.trunc(totalPoints));
}

export function calculateAdventureProgress(
  campaign: AdventureCampaign,
  totalPoints: number
): AdventureProgress {
  const points = clampPoints(totalPoints);
  const stationCount = campaign.stations.length + 1;
  let currentIndex = 0;

  for (let index = 0; index < campaign.stations.length; index += 1) {
    if (points >= campaign.stations[index].unlockAt) {
      currentIndex = index + 1;
    }
  }

  const nextStation = campaign.stations[currentIndex] ?? null;
  const currentStation = currentIndex === 0 ? null : campaign.stations[currentIndex - 1];
  const pointsAtCurrent = currentStation?.unlockAt ?? 0;
  const segmentCost = nextStation ? nextStation.unlockAt - pointsAtCurrent : 0;
  const segmentPoints = nextStation ? points - pointsAtCurrent : 0;
  const pointsToNext = nextStation ? Math.max(0, segmentCost - segmentPoints) : 0;

  return {
    campaignId: campaign.id,
    chapterId: campaign.id,
    totalPoints: points,
    currentStationId: currentStation?.id ?? "start",
    nextStationId: nextStation?.id ?? null,
    segmentPoints,
    segmentCost,
    pointsToNext,
    stationIndex: currentIndex,
    stationCount,
    chapterIndexLabel: `第 ${currentIndex + 1} / ${stationCount} 站`
  };
}

export function getCrossedStations(
  campaign: AdventureCampaign,
  beforePoints: number,
  afterPoints: number
) {
  const before = clampPoints(beforePoints);
  const after = clampPoints(afterPoints);
  if (after >= before) {
    return campaign.stations.filter((station) => station.unlockAt > before && station.unlockAt <= after);
  }
  return campaign.stations
    .filter((station) => station.unlockAt <= before && station.unlockAt > after)
    .reverse();
}

export function getNextStationReward(
  campaign: AdventureCampaign,
  beforePoints: number,
  afterPoints: number
): AdventureStationRewardEvent | null {
  const station = getCrossedStations(campaign, beforePoints, afterPoints)[0];
  if (!station || afterPoints < beforePoints) {
    return null;
  }
  return {
    stationId: station.id,
    reward: station.reward
  };
}

export function calculateAdventurePointAwards(input: PointAwardInput): AdventurePointAward[] {
  const awards: AdventurePointAward[] = [
    {
      uniqueKey: `adventure:checkin:${input.habitId}:${input.dateKey}`,
      amount: 1,
      reason: "checkin",
      habitId: input.habitId,
      checkInId: input.checkInId,
      dateKey: input.dateKey
    }
  ];

  if (input.shouldAwardAllDone) {
    awards.push({
      uniqueKey: `adventure:all_done:${input.dateKey}`,
      amount: 1,
      reason: "all_done",
      habitId: null,
      checkInId: input.checkInId,
      dateKey: input.dateKey
    });
  }

  return awards;
}

export function getStationSummary(campaign: AdventureCampaign, totalPoints: number): StationSummary {
  const progress = calculateAdventureProgress(campaign, totalPoints);
  const unlockSummary = getAdventureUnlockSummary(campaign, totalPoints);
  const nextStation = progress.nextStationId
    ? campaign.stations.find((station) => station.id === progress.nextStationId) ?? null
    : null;
  const title = nextStation ? `去${nextStation.title}` : `${campaign.title}已完成`;
  const subtitle = nextStation
    ? `累计行动力还差 ${progress.pointsToNext} 点到下一站`
    : "这一章已经抵达终点";
  const actionPointLabel = `累计 ${progress.totalPoints} 点`;

  return {
    title,
    subtitle,
    actionPointLabel,
    chapterProgressLabel: `${campaign.title} · 已解锁 ${unlockSummary.unlockedCount} / ${unlockSummary.unlockableCount} 关`
  };
}

export function getAdventureUnlockSummary(
  campaign: AdventureCampaign,
  totalPoints: number
): AdventureUnlockSummary {
  const progress = calculateAdventureProgress(campaign, totalPoints);
  const unlockableCount = campaign.stations.length;
  const totalCampaignCost = campaign.stations.at(-1)?.unlockAt ?? 0;
  const nextStation = campaign.stations[progress.stationIndex] ?? null;

  return {
    totalPoints: progress.totalPoints,
    totalCampaignCost,
    unlockedCount: Math.min(progress.stationIndex, unlockableCount),
    unlockableCount,
    nextUnlockAt: nextStation?.unlockAt ?? null,
    pointsToNext: progress.pointsToNext,
    nextStationTitle: nextStation?.title ?? null
  };
}

export function getAdventureCollectionItems(
  campaign: AdventureCampaign,
  claimedStationIds: ReadonlySet<string>
): AdventureCollectionItem[] {
  return campaign.stations.map((station) => ({
    stationId: station.id,
    stationTitle: station.title,
    requiredPoints: station.unlockAt,
    isUnlocked: claimedStationIds.has(station.id),
    ...station.reward
  }));
}
