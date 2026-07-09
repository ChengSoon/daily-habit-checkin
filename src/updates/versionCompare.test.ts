import { describe, expect, it } from "vitest";
import { compareVersions, isRemoteNewer } from "./versionCompare";

describe("compareVersions", () => {
  it("compares semantic version segments numerically", () => {
    expect(compareVersions("1.0.10", "1.0.2")).toBe(1);
    expect(compareVersions("1.2.0", "1.2")).toBe(0);
    expect(compareVersions("2.0.0", "10.0.0")).toBe(-1);
  });

  it("ignores v prefix and prerelease suffix for release checks", () => {
    expect(compareVersions("v1.0.1", "1.0.0")).toBe(1);
    expect(compareVersions("1.0.1-beta.1", "1.0.1")).toBe(0);
  });
});

describe("isRemoteNewer", () => {
  it("uses app version as the update boundary", () => {
    expect(isRemoteNewer({ version: "1.1.0", buildNumber: 1 }, { version: "1.0.9", buildNumber: 99 })).toBe(true);
    expect(isRemoteNewer({ version: "1.0.0", buildNumber: 12 }, { version: "1.0.0", buildNumber: 11 })).toBe(false);
    expect(isRemoteNewer({ version: "1.0.0", buildNumber: 11 }, { version: "1.0.0", buildNumber: 12 })).toBe(false);
  });
});
