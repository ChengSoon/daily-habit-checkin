import type { ExpoSpeechRecognitionErrorCode } from "expo-speech-recognition";

export type VoiceConversationPhase =
  | "idle"
  | "requesting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

export type VoiceConversationState = {
  active: boolean;
  phase: VoiceConversationPhase;
  transcript: string;
  errorMessage: string | null;
  volume: number;
};

export const initialVoiceConversationState: VoiceConversationState = {
  active: false,
  phase: "idle",
  transcript: "",
  errorMessage: null,
  volume: -2
};

export type VoiceConversationAction =
  | { type: "started" }
  | { type: "listening" }
  | { type: "transcript_changed"; transcript: string }
  | { type: "thinking"; transcript: string }
  | { type: "speaking" }
  | { type: "failed"; message: string }
  | { type: "volume_changed"; volume: number }
  | { type: "stopped" };

export function voiceConversationReducer(
  state: VoiceConversationState,
  action: VoiceConversationAction
): VoiceConversationState {
  switch (action.type) {
    case "started":
      return { ...initialVoiceConversationState, active: true, phase: "requesting" };
    case "listening":
      return { ...state, active: true, phase: "listening", transcript: "", errorMessage: null };
    case "transcript_changed":
      return state.active ? { ...state, transcript: action.transcript } : state;
    case "thinking":
      return { ...state, phase: "thinking", transcript: action.transcript, volume: -2 };
    case "speaking":
      return { ...state, phase: "speaking", transcript: "", volume: -2 };
    case "failed":
      return { ...state, active: true, phase: "error", errorMessage: action.message, volume: -2 };
    case "volume_changed":
      return state.phase === "listening"
        ? { ...state, volume: Math.max(-2, Math.min(10, action.volume)) }
        : state;
    case "stopped":
      return initialVoiceConversationState;
  }
}

export function voiceErrorMessage(error: ExpoSpeechRecognitionErrorCode): string {
  if (error === "not-allowed") return "需要麦克风和语音识别权限才能继续";
  if (error === "service-not-allowed") {
    return "系统语音识别暂不可用，请重试或检查网络";
  }
  if (error === "language-not-supported") return "当前设备暂不支持中文语音识别";
  if (error === "network") return "语音识别网络暂时不可用，请检查网络后重试";
  if (error === "audio-capture") return "暂时无法使用麦克风，请检查麦克风权限或是否被其他应用占用";
  if (error === "busy") return "语音识别正忙，请稍等一下";
  if (error === "no-speech" || error === "speech-timeout") return "我没听清，再说一次吧";
  return "语音识别暂时没有接上，请检查网络后重试";
}

export function isRecoverableVoiceError(error: ExpoSpeechRecognitionErrorCode): boolean {
  return error === "no-speech" || error === "speech-timeout" || error === "network" || error === "busy";
}

export function textForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " 我把代码放在屏幕上了。 ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_#>`~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
