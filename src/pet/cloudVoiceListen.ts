import { SyncError } from "../sync/apiClient";
import { transcribeCompanionAudio } from "./asrClient";
import { recordUtterance } from "./voiceRecorder";
import type { CloudListenOptions } from "./cloudVoiceListenTypes";

export type { CloudListenOptions } from "./cloudVoiceListenTypes";
export { CLOUD_CONVERSATION_RECORD_OPTIONS } from "./cloudVoiceRecordOptions";

export type CloudListenHandlers = {
  active: () => boolean;
  processing: () => boolean;
  onListening: () => void;
  onVolume: (volume: number) => void;
  onNoSpeech: () => void;
  onRecognizing: () => void;
  onTranscript: (text: string) => Promise<void>;
  onError: (message: string) => void;
};

/** 一轮应用内录音识别：不依赖系统 Google 语音服务。 */
export async function listenOnceWithCloudAsr(
  signal: AbortSignal,
  handlers: CloudListenHandlers,
  recordOptions: CloudListenOptions = {}
): Promise<void> {
  if (!handlers.active() || handlers.processing()) return;
  handlers.onListening();
  try {
    const recorded = await recordUtterance({
      signal,
      onVolume: (volume) => {
        if (handlers.active()) handlers.onVolume(volume);
      },
      ...recordOptions
    });
    if (!handlers.active() || signal.aborted || handlers.processing()) return;
    if (!recorded) {
      handlers.onNoSpeech();
      return;
    }
    handlers.onRecognizing();
    const text = await transcribeCompanionAudio({
      audioBase64: recorded.audioBase64,
      mimeType: recorded.mimeType
    });
    if (!handlers.active() || signal.aborted) return;
    await handlers.onTranscript(text);
  } catch (error) {
    if (!handlers.active() || signal.aborted) return;
    const message =
      error instanceof SyncError ? error.message : "语音识别暂时不可用，请检查网络后重试";
    handlers.onError(message);
  }
}
