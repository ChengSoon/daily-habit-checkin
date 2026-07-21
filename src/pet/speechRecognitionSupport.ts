import { Platform } from "react-native";
import {
  androidSpeechUnavailableMessage,
  pickAndroidSpeechService
} from "./speechRecognitionAndroid";
import { loadSpeechRecognitionPackage, type SpeechRecognitionPackage } from "./speechRecognition";

export type SpeechModule = SpeechRecognitionPackage["ExpoSpeechRecognitionModule"];
export { androidSpeechStartOptions } from "./speechRecognitionAndroid";

export type SpeechReadiness =
  | { ok: true; module: SpeechModule; androidServicePackage?: string }
  | { ok: false; reason: "missing-module" | "unavailable"; message: string };

function listAndroidServices(module: SpeechModule): string[] {
  if (Platform.OS !== "android") return [];
  try {
    return module.getSpeechRecognitionServices?.() ?? [];
  } catch {
    return [];
  }
}

/** 检查原生语音模块与设备识别服务是否可用，并选出 Android 识别引擎。 */
export function inspectSpeechRecognition(): SpeechReadiness {
  const module = loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule;
  if (!module) {
    return {
      ok: false,
      reason: "missing-module",
      message: "当前 App 没有原生语音模块，请重装 development build"
    };
  }

  let available = false;
  try {
    available = module.isRecognitionAvailable();
  } catch {
    return {
      ok: false,
      reason: "missing-module",
      message: "原生语音模块尚未装入当前开发构建，请重新构建后安装"
    };
  }

  const services = listAndroidServices(module);
  if (!available) {
    return {
      ok: false,
      reason: "unavailable",
      message:
        Platform.OS === "android"
          ? androidSpeechUnavailableMessage(services)
          : "当前设备没有可用的语音识别服务"
    };
  }

  return {
    ok: true,
    module,
    androidServicePackage:
      Platform.OS === "android" ? pickAndroidSpeechService(services) : undefined
  };
}
