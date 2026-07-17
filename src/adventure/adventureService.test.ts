import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelAdventureClaim,
  changeAdminChapterStatus,
  claimChapter,
  fulfillAdventureClaim,
  loadAdminAdventureClaims,
  loadAdminChapters,
  loadAdventureState,
  moveAdminChapter,
  saveAdminChapter
} from "./adventureService";
import type { AdminAdventureChapter, AdventureState } from "./types";

const fetchAdventureState = vi.fn();
const claimAdventureChapter = vi.fn();
const fetchAdminChapters = vi.fn();
const createAdminChapter = vi.fn();
const updateAdminChapter = vi.fn();
const setAdminChapterStatus = vi.fn();
const reorderAdminChapters = vi.fn();
const fetchAdminAdventureClaims = vi.fn();
const fulfillAdminAdventureClaim = vi.fn();
const cancelAdminAdventureClaim = vi.fn();

vi.mock("./adventureClient", () => ({
  fetchAdventureState: (...args: unknown[]) => fetchAdventureState(...args),
  claimAdventureChapter: (...args: unknown[]) => claimAdventureChapter(...args),
  fetchAdminChapters: (...args: unknown[]) => fetchAdminChapters(...args),
  createAdminChapter: (...args: unknown[]) => createAdminChapter(...args),
  updateAdminChapter: (...args: unknown[]) => updateAdminChapter(...args),
  setAdminChapterStatus: (...args: unknown[]) => setAdminChapterStatus(...args),
  reorderAdminChapters: (...args: unknown[]) => reorderAdminChapters(...args),
  fetchAdminAdventureClaims: (...args: unknown[]) => fetchAdminAdventureClaims(...args),
  fulfillAdminAdventureClaim: (...args: unknown[]) => fulfillAdminAdventureClaim(...args),
  cancelAdminAdventureClaim: (...args: unknown[]) => cancelAdminAdventureClaim(...args)
}));

const sample: AdventureState = {
  lifetimeEarned: 50,
  highestUnlockedOrder: 1,
  claimableCount: 1,
  chapters: [],
  nextChapter: null,
  claims: [],
  pendingFulfillmentCount: 0
};

const adminChapter = (id: string, sortOrder: number): AdminAdventureChapter => ({
  id,
  sortOrder,
  title: id,
  subtitle: null,
  storyText: "story",
  thresholdLifetimeXp: 50 * sortOrder,
  badgeName: "badge",
  badgeDescription: null,
  badgeEmoji: "🏅",
  badgeImageKey: null,
  nodeImageKey: null,
  backgroundImageKey: null,
  mapThemeKey: null,
  rewardType: "badge_story",
  status: "published",
  claimCount: 0
});

describe("adventureService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loadAdventureState passes through client", async () => {
    fetchAdventureState.mockResolvedValue(sample);
    await expect(loadAdventureState()).resolves.toEqual(sample);
  });

  it("claimChapter passes chapter id", async () => {
    claimAdventureChapter.mockResolvedValue({ ...sample, claimableCount: 0 });
    await expect(claimChapter("c1")).resolves.toMatchObject({ claimableCount: 0 });
    expect(claimAdventureChapter).toHaveBeenCalledWith("c1");
  });

  it("saveAdminChapter creates or updates", async () => {
    const input = {
      title: "A",
      storyText: "S",
      thresholdLifetimeXp: 10,
      badgeName: "B"
    };
    createAdminChapter.mockResolvedValue(adminChapter("n1", 1));
    updateAdminChapter.mockResolvedValue(adminChapter("e1", 1));
    await saveAdminChapter(input);
    expect(createAdminChapter).toHaveBeenCalledWith(input);
    await saveAdminChapter(input, "e1");
    expect(updateAdminChapter).toHaveBeenCalledWith("e1", input);
  });

  it("moveAdminChapter reorders neighbors", async () => {
    const list = [adminChapter("a", 1), adminChapter("b", 2), adminChapter("c", 3)];
    reorderAdminChapters.mockResolvedValue([adminChapter("b", 1), adminChapter("a", 2), adminChapter("c", 3)]);
    await moveAdminChapter(list, "b", "up");
    expect(reorderAdminChapters).toHaveBeenCalledWith(["b", "a", "c"]);
  });

  it("changeAdminChapterStatus proxies", async () => {
    setAdminChapterStatus.mockResolvedValue(adminChapter("a", 1));
    await changeAdminChapterStatus("a", "archived");
    expect(setAdminChapterStatus).toHaveBeenCalledWith("a", "archived");
  });

  it("loadAdminChapters proxies", async () => {
    fetchAdminChapters.mockResolvedValue([adminChapter("a", 1)]);
    await expect(loadAdminChapters()).resolves.toHaveLength(1);
  });

  it("fulfillment helpers proxy", async () => {
    fetchAdminAdventureClaims.mockResolvedValue([]);
    fulfillAdminAdventureClaim.mockResolvedValue({ id: "x" });
    cancelAdminAdventureClaim.mockResolvedValue({ id: "y" });
    await loadAdminAdventureClaims();
    await fulfillAdventureClaim("x");
    await cancelAdventureClaim("y", "note");
    expect(fulfillAdminAdventureClaim).toHaveBeenCalledWith("x", undefined);
    expect(cancelAdminAdventureClaim).toHaveBeenCalledWith("y", "note");
  });
});
