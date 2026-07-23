import { describe, expect, it, vi } from "vitest";
import type { PcmPlayer } from "./pcmPlayer";
import type { TtsStreamFn } from "./ttsClient";
import { createStreamingReplySpeaker, type SpeakReplyDeps } from "./voiceReplyPlayer";

vi.mock("expo-speech", () => ({ speak: vi.fn(), stop: vi.fn() }));
vi.mock("./pcmPlayer", () => ({ createPcmPlayer: vi.fn() }));
vi.mock("./ttsClient", () => ({ streamCompanionTts: vi.fn() }));

const AUDIO_CHUNK = {
  data: "AAE=",
  sampleRate: 24000,
  channels: 1,
  encoding: "pcm_s16le"
} as const;

function createPlayerMock(): PcmPlayer {
  return {
    start: vi.fn(async () => undefined),
    enqueue: vi.fn(),
    finish: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined)
  };
}

function createDeps(player: PcmPlayer, streamTts: TtsStreamFn) {
  let currentPlayer: PcmPlayer | null = null;
  let currentController: AbortController | null = null;
  const deps: SpeakReplyDeps = {
    active: () => true,
    createPlayer: () => player,
    streamTts,
    onSpeaking: vi.fn(),
    onResumeListening: vi.fn(),
    onStreamInterrupted: vi.fn(),
    setPlayer: (value) => {
      currentPlayer = value;
    },
    setTtsController: (value) => {
      currentController = value;
    },
    getPlayer: () => currentPlayer,
    getTtsController: () => currentController
  };
  return deps;
}

describe("createStreamingReplySpeaker", () => {
  it("keeps short conversational sentences in one TTS request", async () => {
    const player = createPlayerMock();
    const spokenTexts: string[] = [];
    const streamTts: TtsStreamFn = vi.fn(async ({ text, onAudio }) => {
      spokenTexts.push(text);
      onAudio(AUDIO_CHUNK);
    });
    const deps = createDeps(player, streamTts);
    const speaker = createStreamingReplySpeaker(deps);

    expect(player.start).toHaveBeenCalledOnce();
    speaker.push("我会陪");
    speaker.push("着你。");

    expect(spokenTexts).toEqual([]);
    expect(player.finish).not.toHaveBeenCalled();

    speaker.finish("我会陪着你。先从深呼吸开始。");

    await vi.waitFor(() => expect(spokenTexts).toEqual(["我会陪着你。先从深呼吸开始。"]));
    expect(player.finish).toHaveBeenCalledOnce();
    expect(deps.onSpeaking).toHaveBeenCalledOnce();
    expect(deps.onResumeListening).toHaveBeenCalledOnce();
  });

  it("starts early only after a natural-length sentence boundary", async () => {
    const player = createPlayerMock();
    const spokenTexts: string[] = [];
    const streamTts: TtsStreamFn = vi.fn(async ({ text, onAudio }) => {
      spokenTexts.push(text);
      onAudio(AUDIO_CHUNK);
    });
    const speaker = createStreamingReplySpeaker(createDeps(player, streamTts));
    const firstSentence = "先别急，我们先把今天最重要的那一件做完。";

    speaker.push(firstSentence);

    await vi.waitFor(() => expect(spokenTexts).toEqual([firstSentence]));

    speaker.finish(`${firstSentence}然后再决定要不要继续。`);

    await vi.waitFor(() =>
      expect(spokenTexts).toEqual([firstSentence, "然后再决定要不要继续。"])
    );
  });

  it("uses one TTS request when no early sentence boundary arrives", async () => {
    const player = createPlayerMock();
    const spokenTexts: string[] = [];
    const streamTts: TtsStreamFn = vi.fn(async ({ text, onAudio }) => {
      spokenTexts.push(text);
      onAudio(AUDIO_CHUNK);
    });
    const speaker = createStreamingReplySpeaker(createDeps(player, streamTts));

    speaker.push("我会一直陪着你");
    speaker.finish("我会一直陪着你");

    await vi.waitFor(() => expect(player.finish).toHaveBeenCalledOnce());
    expect(spokenTexts).toEqual(["我会一直陪着你"]);
  });

  it("waits for hidden reasoning to close and speaks only the visible reply", async () => {
    const player = createPlayerMock();
    const spokenTexts: string[] = [];
    const streamTts: TtsStreamFn = vi.fn(async ({ text, onAudio }) => {
      spokenTexts.push(text);
      onAudio(AUDIO_CHUNK);
    });
    const speaker = createStreamingReplySpeaker(createDeps(player, streamTts));

    speaker.push("<think>先分析一下。");
    await Promise.resolve();
    expect(spokenTexts).toEqual([]);

    speaker.push("</think>卡卡回复：我在这里，先陪你把现在这件事慢慢说清楚。");
    await vi.waitFor(() => expect(spokenTexts).toEqual(["我在这里，先陪你把现在这件事慢慢说清楚。"]));
    speaker.finish("<think>先分析一下。</think>卡卡回复：我在这里，先陪你把现在这件事慢慢说清楚。");
    await vi.waitFor(() => expect(player.finish).toHaveBeenCalledOnce());
  });

  it("does not speak an unfinished stage direction", async () => {
    const player = createPlayerMock();
    const spokenTexts: string[] = [];
    const streamTts: TtsStreamFn = vi.fn(async ({ text, onAudio }) => {
      spokenTexts.push(text);
      onAudio(AUDIO_CHUNK);
    });
    const speaker = createStreamingReplySpeaker(createDeps(player, streamTts));

    speaker.push("（轻声地说：我在这里。");
    await Promise.resolve();
    expect(spokenTexts).toEqual([]);

    speaker.push("）别担心，我会陪着你把这件事慢慢说清楚。");
    await vi.waitFor(() => expect(spokenTexts).toEqual(["别担心，我会陪着你把这件事慢慢说清楚。"]));
    speaker.finish("（轻声地说：我在这里。）别担心，我会陪着你把这件事慢慢说清楚。");
    await vi.waitFor(() => expect(player.finish).toHaveBeenCalledOnce());
    expect(spokenTexts).toEqual(["别担心，我会陪着你把这件事慢慢说清楚。"]);
  });
});
