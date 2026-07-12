import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchAdventureState = vi.fn();
const claimAdventureChapter = vi.fn();

vi.mock("./adventureClient", () => ({
  fetchAdventureState: (...args: unknown[]) => fetchAdventureState(...args),
  claimAdventureChapter: (...args: unknown[]) => claimAdventureChapter(...args)
}));

import { claimChapter, loadAdventureState } from "./adventureService";
import type { AdventureState } from "./types";

const sample: AdventureState = {
  lifetimeEarned: 50,
  highestUnlockedOrder: 1,
  claimableCount: 1,
  chapters: [],
  nextChapter: null
};

describe("adventureService", () => {
  beforeEach(() => {
    fetchAdventureState.mockReset();
    claimAdventureChapter.mockReset();
  });

  it("loadAdventureState passes through client", async () => {
    fetchAdventureState.mockResolvedValue(sample);
    await expect(loadAdventureState()).resolves.toEqual(sample);
    expect(fetchAdventureState).toHaveBeenCalledOnce();
  });

  it("claimChapter passes chapter id", async () => {
    claimAdventureChapter.mockResolvedValue({ ...sample, claimableCount: 0 });
    await expect(claimChapter("c1")).resolves.toMatchObject({ claimableCount: 0 });
    expect(claimAdventureChapter).toHaveBeenCalledWith("c1");
  });
});
