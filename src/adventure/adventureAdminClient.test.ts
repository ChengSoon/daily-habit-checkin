import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAdventureStation,
  deleteAdventureStation,
  reorderAdventureStations,
  updateAdventureStation
} from "./adventureAdminClient";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("../sync/apiClient", () => ({ apiRequest: mocks.apiRequest }));

const input = {
  title: "云端花园",
  unlockAt: 30,
  xpEnabled: false,
  xp: 0,
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

describe("adventureAdminClient", () => {
  beforeEach(() => mocks.apiRequest.mockReset());

  it("creates and updates stations", async () => {
    await createAdventureStation(input);
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/adventure/stations", {
      method: "POST",
      body: input
    });

    await updateAdventureStation("station-1", input);
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/adventure/stations/station-1", {
      method: "PUT",
      body: input
    });
  });

  it("deletes and reorders stations with campaign versions", async () => {
    await deleteAdventureStation("station-1", 3);
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      "/api/adventure/stations/station-1?campaignVersion=3",
      { method: "DELETE" }
    );

    await reorderAdventureStations(["station-2", "station-1"], 4);
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/adventure/stations/reorder", {
      method: "POST",
      body: { orderedStationIds: ["station-2", "station-1"], campaignVersion: 4 }
    });
  });
});
