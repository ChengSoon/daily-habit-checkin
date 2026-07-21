import type { ExpoSpeechRecognitionErrorCode } from "expo-speech-recognition";

export type VoiceWakePhase = "idle" | "requesting" | "listening" | "error";

export type VoiceWakeState = {
  active: boolean;
  phase: VoiceWakePhase;
  errorMessage: string | null;
  volume: number;
};

export const initialVoiceWakeState: VoiceWakeState = {
  active: false,
  phase: "idle",
  errorMessage: null,
  volume: -2
};

export type VoiceWakeAction =
  | { type: "started" }
  | { type: "listening" }
  | { type: "failed"; message: string; active?: boolean }
  | { type: "volume_changed"; volume: number }
  | { type: "stopped" };

export function voiceWakeReducer(
  state: VoiceWakeState,
  action: VoiceWakeAction
): VoiceWakeState {
  switch (action.type) {
    case "started":
      return { ...initialVoiceWakeState, active: true, phase: "requesting" };
    case "listening":
      return { ...state, active: true, phase: "listening", errorMessage: null };
    case "failed":
      return {
        ...state,
        active: action.active ?? state.active,
        phase: "error",
        errorMessage: action.message,
        volume: -2
      };
    case "volume_changed":
      return state.phase === "listening"
        ? { ...state, volume: Math.max(-2, Math.min(10, action.volume)) }
        : state;
    case "stopped":
      return initialVoiceWakeState;
  }
}

const WAKE_PHRASE_PATTERN = /(?:卡\s*卡|咔\s*咔|喀\s*喀|k\s*a\s*k\s*a)/iu;

/** 返回唤醒词后的指令；只有识别到唤醒词时才返回非 null。 */
export function commandAfterWakePhrase(transcript: string): string | null {
  const match = WAKE_PHRASE_PATTERN.exec(transcript);
  if (!match || match.index === undefined) return null;

  return transcript
    .slice(match.index + match[0].length)
    .replace(/^[\s\u3000，。！？、,.!?;；:：]+/, "")
    .trim();
}

export function voiceWakeErrorMessage(error: ExpoSpeechRecognitionErrorCode): string {
  if (error === "not-allowed") return "需要麦克风和语音识别权限才能唤醒卡卡";
  if (error === "service-not-allowed") return "当前设备没有可用的语音识别服务";
  if (error === "language-not-supported") return "当前设备暂不支持中文语音唤醒";
  if (error === "network") return "语音唤醒网络暂时不可用";
  if (error === "audio-capture") return "暂时无法使用麦克风唤醒卡卡";
  if (error === "busy") return "语音识别正忙，稍后会继续监听";
  return "语音唤醒暂时没有接上";
}

export function isRecoverableVoiceWakeError(error: ExpoSpeechRecognitionErrorCode): boolean {
  return error === "no-speech" || error === "speech-timeout" || error === "network" || error === "busy";
}
