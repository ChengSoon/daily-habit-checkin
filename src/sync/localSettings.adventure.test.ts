import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAdventureSeenStationIds,
  saveAdventureSeenStationIds
} from "./localSettings";

const mocks = vi.hoisted(() => ({
  getFirstAsync: vi.fn(),
  runAsync: vi.fn()
}));

vi.mock("../db/database", () => ({
  getDatabase: () => ({
    getFirstAsync: mocks.getFirstAsync,
    runAsync: mocks.runAsync
  })
}));

describe("adventure seen station settings", () => {
  beforeEach(() => {
    mocks.getFirstAsync.mockReset();
    mocks.runAsync.mockReset();
  });

  it("reads a valid space and campaign scoped array", async () => {
    mocks.getFirstAsync.mockResolvedValue({ value: "[\"a\",\"b\"]" });

    await expect(
      getAdventureSeenStationIds("space-1", "star-coast")
    ).resolves.toEqual(["a", "b"]);
    expect(mocks.getFirstAsync).toHaveBeenCalledWith(
      "SELECT value FROM local_settings WHERE key = ?",
      ["adventure_seen_stations:space-1:star-coast"]
    );
  });

  it("returns null for malformed local data", async () => {
    mocks.getFirstAsync.mockResolvedValue({ value: "{" });

    await expect(
      getAdventureSeenStationIds("space-1", "star-coast")
    ).resolves.toBeNull();
  });

  it("deduplicates station ids before saving", async () => {
    await saveAdventureSeenStationIds(
      "space-1",
      "star-coast",
      ["a", "a", "b"]
    );

    expect(mocks.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO local_settings"),
      [
        "adventure_seen_stations:space-1:star-coast",
        "[\"a\",\"b\"]"
      ]
    );
  });
});
