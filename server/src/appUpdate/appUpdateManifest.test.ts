import { describe, expect, it, vi } from "vitest";
import { fetchLatestAppUpdateManifest, normalizeAppUpdateManifest } from "./appUpdateManifest.js";

describe("normalizeAppUpdateManifest", () => {
  it("accepts a valid Android manifest", () => {
    expect(
      normalizeAppUpdateManifest({
        platform: "android",
        version: "1.0.1",
        buildNumber: 12,
        mandatory: false,
        releaseDate: "2026-07-09T00:00:00.000Z",
        notes: "更新说明",
        downloadUrl: "https://cdn.example/releases/android/v1.0.1/app.apk",
        sha256: "a".repeat(64),
        sizeBytes: 123456
      })
    ).toMatchObject({ platform: "android", version: "1.0.1", buildNumber: 12 });
  });

  it("rejects non-https download URLs", () => {
    expect(() =>
      normalizeAppUpdateManifest({
        platform: "android",
        version: "1.0.1",
        downloadUrl: "http://cdn.example/app.apk",
        sha256: "a".repeat(64),
        sizeBytes: 1
      })
    ).toThrow("更新下载地址必须使用 HTTPS");
  });
});

describe("fetchLatestAppUpdateManifest", () => {
  it("returns null when manifest URL is not configured", async () => {
    await expect(fetchLatestAppUpdateManifest(undefined, "android")).resolves.toBeNull();
  });

  it("fetches and validates manifest", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          platform: "android",
          version: "1.0.1",
          downloadUrl: "https://cdn.example/app.apk",
          sha256: "b".repeat(64),
          sizeBytes: 2
        })
    });

    const manifest = await fetchLatestAppUpdateManifest("https://cdn.example/latest.json", "android", fetchMock);

    expect(fetchMock).toHaveBeenCalledWith("https://cdn.example/latest.json", { headers: { Accept: "application/json" } });
    expect(manifest?.version).toBe("1.0.1");
  });
});
