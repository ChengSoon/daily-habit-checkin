import { Platform } from "react-native";
import { inspectSpeechRecognition } from "./speechRecognitionSupport";
import { ensureMicrophonePermission } from "./voiceRecorder";

/** 全 Android 统一走应用内录音 + 云端 ASR，不依赖各厂商系统语音引擎。 */
export const USE_CLOUD_ASR = Platform.OS === "android";

export type VoiceSessionPrep =
  | { ok: true; androidServicePackage?: string }
  | { ok: false; message: string };

/** 启动前先完成权限检查（不激活语音 UI），全 Android / iOS 共用。 */
export async function prepareVoiceSession(options?: {
  skipPermission?: boolean;
}): Promise<VoiceSessionPrep> {
  if (options?.skipPermission) return { ok: true };

  if (USE_CLOUD_ASR) {
    const mic = await ensureMicrophonePermission();
    if (mic.granted) return { ok: true };
    return {
      ok: false,
      message: mic.blocked
        ? "麦克风权限被关闭，请到系统设置里允许后重试"
        : "需要麦克风权限才能继续"
    };
  }

  const readiness = inspectSpeechRecognition();
  if (!readiness.ok) return { ok: false, message: readiness.message };
  const permission = await readiness.module.requestPermissionsAsync();
  if (!permission.granted) {
    return { ok: false, message: "需要麦克风和语音识别权限才能继续" };
  }
  return { ok: true, androidServicePackage: readiness.androidServicePackage };
}
