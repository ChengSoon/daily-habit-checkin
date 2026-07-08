import { describe, expect, it } from "vitest";
import { normalizeSyncScreenOptions, shouldRunSyncRefresh } from "./syncScreenRefresh";

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
});
