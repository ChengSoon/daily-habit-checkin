import * as Speech from "expo-speech";
import type { PcmPlayer } from "./pcmPlayer";
import type { TtsAudioChunk, TtsStreamFn } from "./ttsClient";

export class TtsPlaybackError extends Error {
  constructor(message: string, readonly receivedAudio: boolean) {
    super(message);
    this.name = "TtsPlaybackError";
  }
}

export function speakWithSystemSpeech(text: string, onFinished: () => void): void {
  Speech.speak(text, {
    language: "zh-CN",
    pitch: 1.04,
    rate: 0.96,
    onDone: onFinished,
    onStopped: onFinished,
    onError: onFinished
  });
}

export async function streamTtsIntoPlayer(options: {
  text: string;
  player: PcmPlayer;
  streamTts: TtsStreamFn;
  signal: AbortSignal;
  onAudioStarted: () => void;
}): Promise<void> {
  let receivedAudio = false;
  try {
    await options.player.start();
    await options.streamTts(
      options.text,
      (chunk: TtsAudioChunk) => {
        if (!receivedAudio) {
          receivedAudio = true;
          options.onAudioStarted();
        }
        options.player.enqueue(chunk);
      },
      options.signal
    );
    if (!receivedAudio) throw new TtsPlaybackError("TTS 没有返回音频", false);
    await options.player.finish();
  } catch (error) {
    await options.player.stop();
    if (error instanceof TtsPlaybackError) throw error;
    throw new TtsPlaybackError(
      error instanceof Error ? error.message : "语音播放失败",
      receivedAudio
    );
  }
}
