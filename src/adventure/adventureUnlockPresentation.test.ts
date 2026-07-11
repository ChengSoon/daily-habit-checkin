import { describe, expect, it } from "vitest";
import {
  advanceUnlockQueue,
  createUnlockPresentation,
  getUnlockAnimationPlan,
  getPendingRouteIndexes,
  mergeUnlockQueue
} from "./adventureUnlockPresentation";

describe("adventure unlock presentation", () => {
  it("establishes a first-load baseline without replaying history", () => {
    expect(createUnlockPresentation(["a", "b"], null, ["a", "b", "c"])).toEqual({
      pendingStationIds: [],
      nextSeenStationIds: ["a", "b"]
    });
  });

  it("orders unseen claims by campaign order", () => {
    expect(createUnlockPresentation(["c", "a", "b"], ["a"], ["a", "b", "c"])).toEqual({
      pendingStationIds: ["b", "c"],
      nextSeenStationIds: ["a", "b", "c"]
    });
  });

  it("compresses long unlock queues and respects reduced motion", () => {
    expect(getUnlockAnimationPlan(1, false)).toEqual({ mode: "full", durationMs: 1600 });
    expect(getUnlockAnimationPlan(3, false)).toEqual({ mode: "sequence", durationMs: 1500 });
    expect(getUnlockAnimationPlan(4, false)).toEqual({ mode: "sweep", durationMs: 1200 });
    expect(getUnlockAnimationPlan(1, true)).toEqual({ mode: "reduced", durationMs: 250 });
  });

  it("keeps the active snapshot and queues only additional unseen stations", () => {
    expect(mergeUnlockQueue(["b"], ["c"], ["b", "d", "c"])).toEqual(["c", "d"]);
  });

  it("persists the active snapshot before promoting a queued unlock", () => {
    expect(advanceUnlockQueue({
      nextSeenStationIds: ["a", "b", "c"],
      pendingStationIds: ["b"],
      queuedStationIds: ["c"],
      seenStationIds: ["a"]
    })).toEqual({
      completedSeenStationIds: ["a", "b"],
      nextPendingStationIds: ["c"]
    });
  });

  it("keeps multi-unlock travel targets in campaign route order", () => {
    expect(getPendingRouteIndexes(
      ["a", "b", "c", "d"],
      ["d", "b", "c"]
    )).toEqual([2, 3, 4]);
  });
});
