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

export function speakReplyText(reply: string, deps: SpeakReplyDeps): void {
  const spokenText = textForSpeech(reply);
  if (!spokenText) {
    deps.onResumeListening();
    return;
  }

  const speakWithSystem = () => {
    deps.onSpeaking();
    speakWithSystemSpeech(spokenText, () => {
      if (deps.active()) deps.onResumeListening();
    });
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
