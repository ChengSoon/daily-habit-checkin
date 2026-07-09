import { describe, expect, it } from "vitest";
import { createQueuedAsyncRunner, normalizeSyncScreenOptions, shouldRunSyncRefresh } from "./syncScreenRefresh";

describe("sync screen refresh options", () => {
  it("enables foreground refresh by default", () => {
    expect(normalizeSyncScreenOptions().refreshOnForeground).toBe(true);
    expect(normalizeSyncScreenOptions().refreshOnRemoteChange).toBe(true);
  });

  it("allows foreground refresh to be disabled", () => {
    expect(normalizeSyncScreenOptions({ refreshOnForeground: false }).refreshOnForeground).toBe(false);
  });

  it("allows remote change refresh to be disabled", () => {
    expect(normalizeSyncScreenOptions({ refreshOnRemoteChange: false }).refreshOnRemoteChange).toBe(false);
  });

  it("refreshes only while app is active", () => {
    expect(shouldRunSyncRefresh("active")).toBe(true);
    expect(shouldRunSyncRefresh("background")).toBe(false);
    expect(shouldRunSyncRefresh("inactive")).toBe(false);
  });

  it("runs one more refresh when reload is requested during an in-flight refresh", async () => {
    let releaseFirstRefresh!: () => void;
    const firstRefreshGate = new Promise<void>((resolve) => {
      releaseFirstRefresh = resolve;
    });
    const seenStates: string[] = [];
    let currentState = "before-checkin";

    const run = createQueuedAsyncRunner(async () => {
      seenStates.push(currentState);
      if (seenStates.length === 1) {
        await firstRefreshGate;
      }
    });

    const firstRefresh = run();
    currentState = "after-checkin";
    const secondRefresh = run();

    releaseFirstRefresh();
    await secondRefresh;
    await firstRefresh;

    expect(seenStates).toEqual(["before-checkin", "after-checkin"]);
  });
});
