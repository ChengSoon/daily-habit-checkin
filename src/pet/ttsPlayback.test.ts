import { describe, expect, it, vi } from "vitest";
import { streamTtsIntoPlayer } from "./ttsPlayback";
import type { PcmPlayer } from "./pcmPlayer";

vi.mock("expo-speech", () => ({ speak: vi.fn() }));

function playerMock(): PcmPlayer & { chunks: string[] } {
  const player = {
    chunks: [],
    start: vi.fn(async () => undefined),
    enqueue: vi.fn((chunk) => {
      player.chunks.push(chunk.data);
    }),
    finish: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined)
  } as unknown as PcmPlayer & { chunks: string[] };
  return player;
}

describe("streamTtsIntoPlayer", () => {
  it("keeps audio chunks ordered and finishes the queue", async () => {
    const player = playerMock();
    const started = vi.fn();
    await streamTtsIntoPlayer({
      text: "你好",
      player,
      streamTts: async (_text, onAudio) => {
        onAudio({ data: "AAE=", sampleRate: 24000, channels: 1, encoding: "pcm_s16le" });
        onAudio({ data: "AgM=", sampleRate: 24000, channels: 1, encoding: "pcm_s16le" });
      },
      signal: new AbortController().signal,
      onAudioStarted: started
    });

    expect(player.chunks).toEqual(["AAE=", "AgM="]);
    expect(started).toHaveBeenCalledOnce();
    expect(player.finish).toHaveBeenCalledOnce();
    expect(player.stop).not.toHaveBeenCalled();
  });

  it("marks an empty stream as a pre-playback failure", async () => {
    const player = playerMock();
    await expect(
      streamTtsIntoPlayer({
        text: "你好",
        player,
        streamTts: async () => undefined,
        signal: new AbortController().signal,
        onAudioStarted: () => undefined
      })
    ).rejects.toMatchObject({ receivedAudio: false });
    expect(player.stop).toHaveBeenCalledOnce();
  });
});
