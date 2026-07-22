import { commandAfterWakePhrase } from "./voiceWakeState";
import { listenOnceWithCloudAsr } from "./cloudVoiceListen";
import type { CloudListenOptions } from "./cloudVoiceListenTypes";
import { CLOUD_WAKE_RECORD_OPTIONS } from "./cloudVoiceRecordOptions";

export type { CloudListenOptions } from "./cloudVoiceListenTypes";
export { CLOUD_WAKE_RECORD_OPTIONS } from "./cloudVoiceRecordOptions";

export type CloudWakeHandlers = {
  active: () => boolean;
  onListening: () => void;
  onVolume: (volume: number) => void;
  onWake: (command: string) => void;
  onNoMatch: () => void;
  onError: (message: string) => void;
};

/** 一轮应用内唤醒识别：听到“卡卡”后回调 onWake，否则 onNoMatch。 */
export async function listenOnceForWakePhrase(
  signal: AbortSignal,
  handlers: CloudWakeHandlers,
  recordOptions: CloudListenOptions = CLOUD_WAKE_RECORD_OPTIONS
): Promise<void> {
  await listenOnceWithCloudAsr(
    signal,
    {
      active: handlers.active,
      processing: () => false,
      onListening: handlers.onListening,
      onVolume: handlers.onVolume,
      onNoSpeech: handlers.onNoMatch,
      onRecognizing: () => {
        // 唤醒阶段静默转写。
      },
      onTranscript: async (text) => {
        if (!handlers.active()) return;
        const command = commandAfterWakePhrase(text);
        if (command === null) {
          handlers.onNoMatch();
          return;
        }
        handlers.onWake(command);
      },
      onError: handlers.onError
    },
    recordOptions
  );
}
