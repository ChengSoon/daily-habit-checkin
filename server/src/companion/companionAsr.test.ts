import { afterEach, describe, expect, it, vi } from "vitest";
import { createCompanionAsrService } from "./companionAsr.js";

describe("createCompanionAsrService (tencent)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("transcribes audio via Tencent sentence recognition", async () => {
    const recognize = vi.fn(async () => ({ Result: "  今天  打卡 " }));
    const service = createCompanionAsrService({ recognize, engineModelType: "16k_zh" });
    const audioBase64 = Buffer.alloc(512, 1).toString("base64");

    const result = await service.transcribe({
      audioBase64,
      mimeType: "audio/m4a",
      language: "zh"
    });

    expect(result).toEqual({ text: "今天 打卡" });
    expect(recognize).toHaveBeenCalledOnce();
    expect(recognize.mock.calls.at(0)?.at(0)).toMatchObject({
      EngSerViceType: "16k_zh",
      SourceType: 1,
      VoiceFormat: "m4a",
      Data: audioBase64,
      DataLen: 512
    });
  });

  it("maps mime types to tencent voice formats", async () => {
    const recognize = vi.fn(async () => ({ Result: "你好" }));
    const service = createCompanionAsrService({ recognize });
    await service.transcribe({
      audioBase64: Buffer.alloc(512, 2).toString("base64"),
      mimeType: "audio/mpeg"
    });
    expect(recognize.mock.calls.at(0)?.at(0)).toMatchObject({ VoiceFormat: "mp3" });
  });

  it("rejects empty and oversized payloads", async () => {
    const recognize = vi.fn(async () => ({ Result: "x" }));
    const service = createCompanionAsrService({ recognize });
    await expect(
      service.transcribe({ audioBase64: "YQ==", mimeType: "audio/m4a" })
    ).rejects.toThrow("ASR_EMPTY_AUDIO");
    await expect(
      service.transcribe({
        audioBase64: Buffer.alloc(3_000_001, 1).toString("base64"),
        mimeType: "audio/m4a"
      })
    ).rejects.toThrow("ASR_TOO_LARGE");
    expect(recognize).not.toHaveBeenCalled();
  });

  it("reports missing credentials when no injectable client", async () => {
    vi.stubEnv("TENCENT_SECRET_ID", "");
    vi.stubEnv("TENCENT_SECRET_KEY", "");
    const service = createCompanionAsrService({});
    await expect(
      service.transcribe({
        audioBase64: Buffer.alloc(512, 1).toString("base64"),
        mimeType: "audio/m4a"
      })
    ).rejects.toThrow("ASR_UNAVAILABLE");
  });

  it("maps auth failures to ASR_UNAVAILABLE", async () => {
    const recognize = vi.fn(async () => {
      throw new Error("AuthFailure.SecretIdNotFound");
    });
    const service = createCompanionAsrService({ recognize });
    await expect(
      service.transcribe({
        audioBase64: Buffer.alloc(512, 1).toString("base64"),
        mimeType: "audio/m4a"
      })
    ).rejects.toThrow("ASR_UNAVAILABLE");
  });
});
