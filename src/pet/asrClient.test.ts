import { describe, expect, it, vi, beforeEach } from "vitest";

const apiRequest = vi.fn();
vi.mock("../sync/apiClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  SyncError: class SyncError extends Error {
    constructor(message: string, readonly status?: number) {
      super(message);
      this.name = "SyncError";
    }
  }
}));

describe("transcribeCompanionAudio", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("returns trimmed transcript text", async () => {
    apiRequest.mockResolvedValue({ text: "  一起打卡  " });
    const { transcribeCompanionAudio } = await import("./asrClient");
    await expect(
      transcribeCompanionAudio({ audioBase64: "AAA", mimeType: "audio/m4a" })
    ).resolves.toBe("一起打卡");
    expect(apiRequest).toHaveBeenCalledWith("/api/companion/asr", {
      method: "POST",
      body: { audioBase64: "AAA", mimeType: "audio/m4a", language: "zh" }
    });
  });
});
