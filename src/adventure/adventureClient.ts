import { apiRequest } from "../sync/apiClient";
import { AdventureCampaign, AdventurePointAward } from "./types";

export type AdventureProgressDto = {
  campaignId: string;
  chapterId: string;
  totalPoints: number;
  currentStationId: string;
  nextStationId: string | null;
  segmentPoints: number;
  updatedAt: string;
};

export type AwardAdventureInput = {
  habitId: string;
  dateKey: string;
  checkInId: string;
};

export type AwardAdventureResult = {
  insertedPoints: AdventurePointAward[];
  progress: AdventureProgressDto;
};

export type AdventureStationRewardDto = {
  id: string;
  stationId: string;
  xpTransactionKey: string | null;
  claimedAt: string;
  reversedAt: null;
};

export async function awardAdventureForCheckIn(input: AwardAdventureInput): Promise<AwardAdventureResult> {
  return apiRequest<AwardAdventureResult>("/api/adventure/checkin-awards", {
    method: "POST",
    body: input
  });
}

export async function revokeAdventureForCheckIn(input: AwardAdventureInput): Promise<AwardAdventureResult> {
  return apiRequest<AwardAdventureResult>("/api/adventure/checkin-awards/revoke", {
    method: "POST",
    body: input
  });
}

export async function fetchAdventureProgress(): Promise<AdventureProgressDto> {
  return apiRequest<AdventureProgressDto>("/api/adventure/progress");
}

export async function fetchAdventureCampaign(): Promise<AdventureCampaign> {
  return apiRequest<AdventureCampaign>("/api/adventure/campaign");
}

export async function fetchAdventureRewards(): Promise<AdventureStationRewardDto[]> {
  return apiRequest<AdventureStationRewardDto[]>("/api/adventure/rewards");
}
