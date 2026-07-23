import * as Speech from "expo-speech";
import { createPcmPlayer, type PcmPlayer } from "./pcmPlayer";
import { speakWithSystemSpeech, streamTtsIntoPlayer, TtsPlaybackError } from "./ttsPlayback";
import { streamCompanionTts, type TtsStreamFn } from "./ttsClient";
import { textForSpeech } from "./voiceConversationState";

export type SpeakReplyDeps = {
  active: () => boolean;
  createPlayer?: () => PcmPlayer;
  streamTts?: TtsStreamFn;
  onSpeaking: () => void;
  onResumeListening: () => void;
  onStreamInterrupted: () => void;
  setTtsController: (controller: AbortController | null) => void;
  setPlayer: (player: PcmPlayer | null) => void;
  getPlayer: () => PcmPlayer | null;
  getTtsController: () => AbortController | null;
};

export type StreamingReplySpeaker = {
  push: (delta: string) => void;
  finish: (reply: string) => void;
  cancel: () => void;
};

const MIN_EARLY_SPEECH_LENGTH = 18;

function findEarlyReplyPrefix(text: string): string | null {
  for (const match of text.matchAll(/[。！？!?；;\n]/gu)) {
    const end = (match.index ?? 0) + match[0].length;
    const prefix = text.slice(0, end).trim();
    const speechLength = prefix.replace(/\s/gu, "").length;
    if (speechLength >= MIN_EARLY_SPEECH_LENGTH) return prefix;
  }
  return null;
}

function hasUnclosedSpeechBlock(text: string): boolean {
  const thinkOpen = text.lastIndexOf("<think>");
  const thinkClose = text.lastIndexOf("</think>");
  const codeFenceCount = text.match(/```/gu)?.length ?? 0;
  const unclosedPair = [
    ["（", "）"],
    ["(", ")"],
    ["【", "】"],
    ["[", "]"]
  ].some(([open, close]) => text.lastIndexOf(open) > text.lastIndexOf(close));
  return thinkOpen > thinkClose || codeFenceCount % 2 === 1 || unclosedPair;
}

function findEarlySpeech(text: string): string | null {
  if (hasUnclosedSpeechBlock(text)) return null;
  return findEarlyReplyPrefix(textForSpeech(text));
}

function speakSystemReply(reply: string, deps: SpeakReplyDeps): void {
  const spokenText = textForSpeech(reply);
  if (!spokenText) {
    deps.onResumeListening();
    return;
  }
  deps.onSpeaking();
  speakWithSystemSpeech(spokenText, () => {
    if (deps.active()) deps.onResumeListening();
  });
}

function createReplyPlayer(deps: SpeakReplyDeps): PcmPlayer | null {
  let player: PcmPlayer | null = null;
  try {
    player = (deps.createPlayer ?? createPcmPlayer)();
  } catch {
    player = null;
  }
  return player;
}

function createSystemReplySpeaker(deps: SpeakReplyDeps): StreamingReplySpeaker {
  let cancelled = false;
  return {
    push: () => undefined,
    finish: (reply) => {
      if (!cancelled) speakSystemReply(reply, deps);
    },
    cancel: () => {
      cancelled = true;
    }
  };
}

class StreamingReplyPlayback implements StreamingReplySpeaker {
  private readonly controller = new AbortController();
  private readonly firstPromise: Promise<string | null>;
  private readonly finalPromise: Promise<string>;
  private resolveFirst: (value: string | null) => void = () => undefined;
  private resolveFinal: (value: string) => void = () => undefined;
  private firstReply: string | null = null;
  private replyBuffer = "";
  private firstResolved = false;
  private finalReply: string | null = null;
  private finalResolved = false;
  private cancelled = false;
  private receivedAudio = false;

  constructor(
    private readonly deps: SpeakReplyDeps,
    private readonly player: PcmPlayer,
    private readonly streamTts: TtsStreamFn
  ) {
    this.firstPromise = new Promise((resolve) => {
      this.resolveFirst = resolve;
    });
    this.finalPromise = new Promise((resolve) => {
      this.resolveFinal = resolve;
    });
    deps.setTtsController(this.controller);
    deps.setPlayer(player);
    void this.run();
  }

  push(delta: string): void {
    if (this.cancelled || this.finalResolved || this.firstResolved) return;
    this.replyBuffer += delta;
    const speech = findEarlySpeech(this.replyBuffer);
    if (speech) this.resolveFirstReply(speech);
  }

  finish(reply: string): void {
    if (this.cancelled || this.finalResolved) return;
    this.finalResolved = true;
    this.finalReply = reply;
    this.resolveFirstReply(null);
    this.resolveFinal(reply);
  }

  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    this.controller.abort();
    this.resolveFirstReply(null);
    if (!this.finalResolved) {
      this.finalResolved = true;
      this.finalReply = "";
      this.resolveFinal("");
    }
    void this.player.stop();
  }

  private resolveFirstReply(value: string | null): void {
    if (this.firstResolved) return;
    this.firstResolved = true;
    this.resolveFirst(value);
  }

  private async streamSegment(text: string): Promise<void> {
    let segmentReceivedAudio = false;
    await this.streamTts({
      text,
      signal: this.controller.signal,
      onAudio: (chunk) => {
        segmentReceivedAudio = true;
        if (!this.receivedAudio) {
          this.receivedAudio = true;
          this.deps.onSpeaking();
        }
        this.player.enqueue(chunk);
      }
    });
    if (!segmentReceivedAudio) throw new TtsPlaybackError("TTS 没有返回音频", this.receivedAudio);
  }

  private async run(): Promise<void> {
    try {
      await this.player.start();
      const earlyReply = await this.firstPromise;
      if (earlyReply) {
        this.firstReply = earlyReply;
        await this.streamSegment(earlyReply);
      }
      const reply = await this.finalPromise;
      const fullSpeech = textForSpeech(reply);
      const remainingSpeech = this.firstReply && fullSpeech.startsWith(this.firstReply)
        ? fullSpeech.slice(this.firstReply.length).trim()
        : fullSpeech;
      if (remainingSpeech) await this.streamSegment(remainingSpeech);
      if (!this.receivedAudio) {
        await this.player.stop();
        if (this.isActive()) speakSystemReply(reply, this.deps);
        return;
      }
      await this.player.finish();
      if (this.isActive()) this.deps.onResumeListening();
    } catch {
      await this.handleFailure();
    } finally {
      this.cleanup();
    }
  }

  private async handleFailure(): Promise<void> {
    if (!this.isActive()) return;
    const reply = this.finalResolved ? this.finalReply ?? "" : await this.finalPromise;
    if (!this.isActive()) return;
    await this.player.stop();
    if (!this.receivedAudio) speakSystemReply(reply, this.deps);
    else this.deps.onStreamInterrupted();
  }

  private isActive(): boolean {
    return !this.cancelled && this.deps.active() && !this.controller.signal.aborted;
  }

  private cleanup(): void {
    if (this.deps.getTtsController() === this.controller) this.deps.setTtsController(null);
    if (this.deps.getPlayer() === this.player) this.deps.setPlayer(null);
  }
}

export function createStreamingReplySpeaker(deps: SpeakReplyDeps): StreamingReplySpeaker {
  const player = createReplyPlayer(deps);
  if (!player) return createSystemReplySpeaker(deps);
  return new StreamingReplyPlayback(
    deps,
    player,
    deps.streamTts ?? streamCompanionTts
  );
}

export function speakReplyText(reply: string, deps: SpeakReplyDeps): void {
  const spokenText = textForSpeech(reply);
  if (!spokenText) {
    deps.onResumeListening();
    return;
  }

  const speakWithSystem = () => {
    speakSystemReply(spokenText, deps);
  };

  const controller = new AbortController();
  deps.setTtsController(controller);
  let player: PcmPlayer | null = null;
  try {
    player = (deps.createPlayer ?? createPcmPlayer)();
  } catch {
    player = null;
  }
  deps.setPlayer(player);
  if (!player) {
    speakWithSystem();
    return;
  }

  const streamTts = deps.streamTts ?? streamCompanionTts;
  void (async () => {
    try {
      await streamTtsIntoPlayer({
        text: spokenText,
        player,
        streamTts,
        signal: controller.signal,
        onAudioStarted: deps.onSpeaking
      });
      if (deps.active()) deps.onResumeListening();
    } catch (error) {
      if (!deps.active() || controller.signal.aborted) return;
      if (!(error instanceof TtsPlaybackError) || !error.receivedAudio) {
        speakWithSystem();
        return;
      }
      deps.onStreamInterrupted();
    } finally {
      if (deps.getTtsController() === controller) deps.setTtsController(null);
      if (deps.getPlayer() === player) deps.setPlayer(null);
    }
  })();
}

export async function stopSpeechPlayback(player: PcmPlayer | null, controller: AbortController | null) {
  controller?.abort();
  await player?.stop();
  await Speech.stop();
}
