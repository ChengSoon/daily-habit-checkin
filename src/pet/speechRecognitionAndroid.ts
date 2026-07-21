/** 优先选择的 Android 系统语音识别服务（仅作可选增强，不依赖 Google）。 */
export const PREFERRED_ANDROID_SPEECH_SERVICES = [
  "com.iflytek.speechcloud",
  "com.iflytek.inputmethod",
  "com.xiaomi.mibrain.speech",
  "com.miui.voiceassist",
  "com.huawei.vassistant",
  "com.samsung.android.bixby.agent",
  "com.google.android.googlequicksearchbox",
  "com.google.android.as",
  "com.google.android.tts"
] as const;

/** 在已发现的服务列表中挑选最稳妥的 Android 识别引擎。 */
export function pickAndroidSpeechService(services: string[]): string | undefined {
  if (services.length === 0) return undefined;
  return (
    PREFERRED_ANDROID_SPEECH_SERVICES.find((pkg) => services.includes(pkg)) ?? services[0]
  );
}

export function androidSpeechUnavailableMessage(services: string[]): string {
  if (services.length === 0) {
    return "当前手机没有系统语音识别服务，已改用应用内识别时请确保网络畅通";
  }
  return "系统语音识别暂不可用，可改用应用内识别或检查网络后重试";
}

export function androidSpeechStartOptions(androidServicePackage?: string) {
  return androidServicePackage
    ? { androidRecognitionServicePackage: androidServicePackage }
    : {};
}
