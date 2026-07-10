import { apiRequest } from "../sync/apiClient";
import type { AdventureCampaign } from "./types";

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

export function createAdventureStation(input: AdventureStationWriteInput): Promise<AdventureCampaign> {
  return apiRequest<AdventureCampaign>("/api/adventure/stations", { method: "POST", body: input });
}

export function updateAdventureStation(
  stationId: string,
  input: AdventureStationWriteInput
): Promise<AdventureCampaign> {
  return apiRequest<AdventureCampaign>(`/api/adventure/stations/${stationId}`, {
    method: "PUT",
    body: input
  });
}

export function deleteAdventureStation(stationId: string, campaignVersion: number): Promise<void> {
  return apiRequest<void>(`/api/adventure/stations/${stationId}?campaignVersion=${campaignVersion}`, {
    method: "DELETE"
  });
}

export function reorderAdventureStations(
  orderedStationIds: string[],
  campaignVersion: number
): Promise<AdventureCampaign> {
  return apiRequest<AdventureCampaign>("/api/adventure/stations/reorder", {
    method: "POST",
    body: { orderedStationIds, campaignVersion }
  });
}
