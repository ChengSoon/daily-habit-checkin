import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkForAppUpdate } from "./updateClient";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn()
}));

vi.mock("../sync/apiClient", () => ({
  apiRequest: mocks.apiRequest
}));

describe("checkForAppUpdate", () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it("returns available update when remote version is newer", async () => {
    mocks.apiRequest.mockResolvedValue({
      platform: "android",
      version: "1.0.1",
      buildNumber: 2,
      mandatory: false,
      downloadUrl: "https://cdn.example/app.apk",
      sha256: "c".repeat(64),
      sizeBytes: 100
    });

    const result = await checkForAppUpdate({ platform: "android", version: "1.0.0", buildNumber: 1 });

    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/app-update/latest?platform=android", { anonymous: true });
    expect(result.status).toBe("available");
    if (result.status !== "available") {
      throw new Error("expected available update");
    }
    expect(result.update?.version).toBe("1.0.1");
  });

  it("returns current when remote is not newer", async () => {
    mocks.apiRequest.mockResolvedValue({
      platform: "android",
      version: "1.0.0",
      buildNumber: 1,
      downloadUrl: "https://cdn.example/app.apk",
      sha256: "c".repeat(64),
      sizeBytes: 100
    });

    await expect(checkForAppUpdate({ platform: "android", version: "1.0.0", buildNumber: 1 })).resolves.toMatchObject({
      status: "current"
    });
  });

  it("returns unconfigured when backend has no manifest", async () => {
    mocks.apiRequest.mockResolvedValue(undefined);

    await expect(checkForAppUpdate({ platform: "android", version: "1.0.0", buildNumber: 1 })).resolves.toMatchObject({
      status: "unconfigured"
    });
  });

  it("does not call backend on unsupported platforms", async () => {
    await expect(checkForAppUpdate({ platform: "ios", version: "1.0.0", buildNumber: 1 })).resolves.toMatchObject({
      status: "unsupported"
    });
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });
});
