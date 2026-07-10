import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  awardAdventureForCheckIn,
  fetchAdventureCampaign,
  fetchAdventureProgress,
  fetchAdventureRewards,
  revokeAdventureForCheckIn
} from "./adventureClient";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn()
}));

vi.mock("../sync/apiClient", () => ({
  apiRequest: mocks.apiRequest
}));

describe("adventureClient", () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it("posts check-in award requests to the adventure endpoint", async () => {
    mocks.apiRequest.mockResolvedValue({
      insertedPoints: [],
      progress: {
        campaignId: "star-coast",
        chapterId: "star-coast",
        totalPoints: 1,
        currentStationId: "start",
        nextStationId: "moonlight-tower",
        segmentPoints: 1,
        updatedAt: "2026-07-10T00:00:00.000Z"
      }
    });

    await awardAdventureForCheckIn({
      habitId: "habit-1",
      dateKey: "2026-07-10",
      checkInId: "checkin-1"
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/adventure/checkin-awards", {
      method: "POST",
      body: {
        habitId: "habit-1",
        dateKey: "2026-07-10",
        checkInId: "checkin-1"
      }
    });
  });

  it("posts check-in revoke requests to the adventure endpoint", async () => {
    mocks.apiRequest.mockResolvedValue({
      insertedPoints: [],
      progress: {
        campaignId: "star-coast",
        chapterId: "star-coast",
        totalPoints: 0,
        currentStationId: "start",
        nextStationId: "moonlight-tower",
        segmentPoints: 0,
        updatedAt: "2026-07-10T00:00:00.000Z"
      }
    });

    await revokeAdventureForCheckIn({
      habitId: "habit-1",
      dateKey: "2026-07-10",
      checkInId: "checkin-1"
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/adventure/checkin-awards/revoke", {
      method: "POST",
      body: {
        habitId: "habit-1",
        dateKey: "2026-07-10",
        checkInId: "checkin-1"
      }
    });
  });

  it("fetches the shared adventure progress", async () => {
    mocks.apiRequest.mockResolvedValue({
      campaignId: "star-coast",
      chapterId: "star-coast",
      totalPoints: 4,
      currentStationId: "start",
      nextStationId: "moonlight-tower",
      segmentPoints: 4,
      updatedAt: "2026-07-10T00:00:00.000Z"
    });

    await fetchAdventureProgress();

    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/adventure/progress");
  });

  it("fetches the dynamic adventure campaign", async () => {
    mocks.apiRequest.mockResolvedValue({ id: "star-coast", title: "星河海岸", version: 1, stations: [] });

    await fetchAdventureCampaign();

    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/adventure/campaign");
  });

  it("fetches active unlocked station rewards", async () => {
    mocks.apiRequest.mockResolvedValue([
      {
        id: "reward-1",
        stationId: "moonlight-tower",
        xpTransactionKey: "adventure_station:moonlight-tower",
        claimedAt: "2026-07-10T00:00:00.000Z",
        reversedAt: null
      }
    ]);

    await fetchAdventureRewards();

    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/adventure/rewards");
  });
});
