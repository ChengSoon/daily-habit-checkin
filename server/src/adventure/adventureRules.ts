export type AdventureReward = {
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
};

export type AdventureStation = {
  id: string;
  title: string;
  sortOrder: number;
  unlockAt: number;
  version: number;
  everUnlocked: boolean;
  reward: AdventureReward;
};

export type AdventureCampaign = {
  id: string;
  title: string;
  subtitle: string | null;
  version: number;
  stations: AdventureStation[];
};

type AdventureProgress = {
  campaignId: string;
  chapterId: string;
  totalPoints: number;
  currentStationId: string;
  nextStationId: string | null;
  segmentPoints: number;
  segmentCost: number;
  pointsToNext: number;
  stationIndex: number;
  stationCount: number;
};

type PointAwardInput = {
  habitId: string;
  dateKey: string;
  checkInId: string;
  shouldAwardAllDone: boolean;
};

type AdventurePointAward = {
  uniqueKey: string;
  amount: number;
  reason: "checkin" | "all_done" | "checkin_undo" | "all_done_undo";
  habitId: string | null;
  checkInId: string;
  dateKey: string;
};

type PointAwardMutationInput = PointAwardInput & {
  checkInBalance: number;
  allDoneBalance: number;
  hasCheckInHistory: boolean;
  hasAllDoneHistory: boolean;
};

type PointRevokeInput = Omit<PointAwardInput, "shouldAwardAllDone"> & {
  checkInBalance: number;
  allDoneBalance: number;
};

type AdventureStationRewardEvent = {
  stationId: string;
  reward: AdventureReward;
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
    stationCount
  };
}

export function getCrossedStations(
  campaign: AdventureCampaign,
  beforePoints: number,
  afterPoints: number
): AdventureStation[] {
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

export function calculateAdventurePointAwardMutations(input: PointAwardMutationInput): AdventurePointAward[] {
  const awards = calculateAdventurePointAwards(input);

  return awards.flatMap((award) => {
    const isCheckIn = award.reason === "checkin";
    const balance = isCheckIn ? input.checkInBalance : input.allDoneBalance;
    if (balance > 0) {
      return [];
    }

    const hasHistory = isCheckIn ? input.hasCheckInHistory : input.hasAllDoneHistory;
    if (!hasHistory) {
      return [award];
    }

    return [{
      ...award,
      uniqueKey: isCheckIn
        ? `adventure_redo:checkin:${input.habitId}:${input.dateKey}:${input.checkInId}`
        : `adventure_redo:all_done:${input.dateKey}:${input.checkInId}`
    }];
  });
}

export function calculateAdventurePointRevocations(input: PointRevokeInput): AdventurePointAward[] {
  const revocations: AdventurePointAward[] = [];

  if (input.checkInBalance > 0) {
    revocations.push({
      uniqueKey: `adventure_undo:checkin:${input.habitId}:${input.dateKey}:${input.checkInId}`,
      amount: -1,
      reason: "checkin_undo",
      habitId: input.habitId,
      checkInId: input.checkInId,
      dateKey: input.dateKey
    });
  }

  if (input.allDoneBalance > 0) {
    revocations.push({
      uniqueKey: `adventure_undo:all_done:${input.dateKey}:${input.checkInId}`,
      amount: -1,
      reason: "all_done_undo",
      habitId: null,
      checkInId: input.checkInId,
      dateKey: input.dateKey
    });
  }

  return revocations;
}
