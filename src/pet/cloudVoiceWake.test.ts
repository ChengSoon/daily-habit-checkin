import { describe, expect, it, vi, beforeEach } from "vitest";

const listenOnceWithCloudAsr = vi.fn();
vi.mock("./cloudVoiceListen", () => ({
  listenOnceWithCloudAsr: (...args: unknown[]) => listenOnceWithCloudAsr(...args)
}));

describe("listenOnceForWakePhrase", () => {
  beforeEach(() => {
    listenOnceWithCloudAsr.mockReset();
  });

  it("识别到卡卡后触发 onWake 并带上后续指令", async () => {
    listenOnceWithCloudAsr.mockImplementation(async (_signal, handlers) => {
      await handlers.onTranscript("卡卡，帮我看看今天");
    });
    const { listenOnceForWakePhrase } = await import("./cloudVoiceWake");
    const onWake = vi.fn();
    const onNoMatch = vi.fn();
    await listenOnceForWakePhrase(new AbortController().signal, {
      active: () => true,
      onListening: () => undefined,
      onVolume: () => undefined,
      onWake,
      onNoMatch,
      onError: () => undefined
    });
    expect(onWake).toHaveBeenCalledWith("帮我看看今天");
    expect(onNoMatch).not.toHaveBeenCalled();
  });

  it("没有唤醒词时走 onNoMatch", async () => {
    listenOnceWithCloudAsr.mockImplementation(async (_signal, handlers) => {
      await handlers.onTranscript("今天天气不错");
    });
    const { listenOnceForWakePhrase } = await import("./cloudVoiceWake");
    const onWake = vi.fn();
    const onNoMatch = vi.fn();
    await listenOnceForWakePhrase(new AbortController().signal, {
      active: () => true,
      onListening: () => undefined,
      onVolume: () => undefined,
      onWake,
      onNoMatch,
      onError: () => undefined
    });
    expect(onWake).not.toHaveBeenCalled();
    expect(onNoMatch).toHaveBeenCalledOnce();
  });

  it("使用更短静音的唤醒录音参数", async () => {
    listenOnceWithCloudAsr.mockResolvedValue(undefined);
    const { CLOUD_WAKE_RECORD_OPTIONS, listenOnceForWakePhrase } = await import("./cloudVoiceWake");
    await listenOnceForWakePhrase(new AbortController().signal, {
      active: () => true,
      onListening: () => undefined,
      onVolume: () => undefined,
      onWake: () => undefined,
      onNoMatch: () => undefined,
      onError: () => undefined
    });
    expect(listenOnceWithCloudAsr).toHaveBeenCalledWith(
      expect.any(AbortSignal),
      expect.any(Object),
      CLOUD_WAKE_RECORD_OPTIONS
    );
    expect(CLOUD_WAKE_RECORD_OPTIONS.silenceDurationMs).toBeLessThan(1100);
    expect(CLOUD_WAKE_RECORD_OPTIONS.minSpeechMs).toBeLessThan(450);
  });
});
