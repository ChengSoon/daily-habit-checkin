export type UnlockAnimationPlan = {
  mode: "full" | "sequence" | "sweep" | "reduced";
  durationMs: number;
};

export type UnlockPresentation = {
  pendingStationIds: string[];
  nextSeenStationIds: string[];
};

export function createUnlockPresentation(
  claimedStationIds: string[],
  seenStationIds: string[] | null,
  campaignOrder: string[]
): UnlockPresentation {
  const claimed = new Set(claimedStationIds);
  const orderedClaimed = campaignOrder.filter((id) => claimed.has(id));
  if (seenStationIds === null) {
    return { pendingStationIds: [], nextSeenStationIds: orderedClaimed };
  }
  const seen = new Set(seenStationIds);
  return {
    pendingStationIds: orderedClaimed.filter((id) => !seen.has(id)),
    nextSeenStationIds: Array.from(new Set([...seenStationIds, ...orderedClaimed]))
  };
}

export function getUnlockAnimationPlan(
  count: number,
  reducedMotion: boolean
): UnlockAnimationPlan {
  if (reducedMotion) return { mode: "reduced", durationMs: 250 };
  if (count <= 1) return { mode: "full", durationMs: 1600 };
  if (count <= 3) return { mode: "sequence", durationMs: count * 500 };
  return { mode: "sweep", durationMs: 1200 };
}

export function getPendingRouteIndexes(
  campaignOrder: string[],
  pendingStationIds: string[]
): number[] {
  const pending = new Set(pendingStationIds);
  return campaignOrder.flatMap((id, index) => pending.has(id) ? [index + 1] : []);
}

export function mergeUnlockQueue(
  activeStationIds: string[],
  queuedStationIds: string[],
  incomingStationIds: string[]
): string[] {
  const active = new Set(activeStationIds);
  return Array.from(new Set([
    ...queuedStationIds,
    ...incomingStationIds.filter((id) => !active.has(id))
  ]));
}

export function advanceUnlockQueue(input: {
  nextSeenStationIds: string[];
  pendingStationIds: string[];
  queuedStationIds: string[];
  seenStationIds: string[];
}): {
  completedSeenStationIds: string[];
  nextPendingStationIds: string[];
} {
  if (input.queuedStationIds.length === 0) {
    return {
      completedSeenStationIds: input.nextSeenStationIds,
      nextPendingStationIds: []
    };
  }
  return {
    completedSeenStationIds: Array.from(new Set([
      ...input.seenStationIds,
      ...input.pendingStationIds
    ])),
    nextPendingStationIds: input.queuedStationIds
  };
}
