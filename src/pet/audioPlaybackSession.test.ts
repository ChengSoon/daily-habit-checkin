import { describe, expect, it, vi } from "vitest";
import {
  activateCompanionAudioPlayback,
  prepareCompanionAudioPlayback,
  type CompanionAudioApi
} from "./audioPlaybackSession";

function mockApi(): CompanionAudioApi {
  return {
    AudioManager: {
      observeAudioInterruptions: vi.fn(),
      setAudioSessionOptions: vi.fn(),
      setAudioSessionActivity: vi.fn(async () => undefined)
    }
  } as unknown as CompanionAudioApi;
}

describe("audioPlaybackSession", () => {
  it("申请媒体音频焦点并配置扬声器播放会话", async () => {
    const api = mockApi();
    prepareCompanionAudioPlayback(api);
    expect(api.AudioManager.observeAudioInterruptions).toHaveBeenCalledWith("gain");
    expect(api.AudioManager.setAudioSessionOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        iosCategory: "playback",
        iosOptions: expect.arrayContaining(["defaultToSpeaker"])
      })
    );

    await activateCompanionAudioPlayback(api);
    expect(api.AudioManager.setAudioSessionActivity).toHaveBeenCalledWith(true);
  });

  it("没有原生模块时静默跳过", async () => {
    await expect(activateCompanionAudioPlayback(null)).resolves.toBeUndefined();
  });
});
