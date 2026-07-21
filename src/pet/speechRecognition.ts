import type {
  ExpoSpeechRecognitionNativeEventMap
} from "expo-speech-recognition";

export type SafeSpeechEventHook = <K extends keyof ExpoSpeechRecognitionNativeEventMap>(
  eventName: K,
  listener: (event: ExpoSpeechRecognitionNativeEventMap[K]) => void
) => void;

export type SpeechRecognitionPackage = {
  ExpoSpeechRecognitionModule: typeof import("expo-speech-recognition").ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent: SafeSpeechEventHook;
};

const noopSpeechEventHook: SafeSpeechEventHook = () => undefined;

declare const require: (moduleName: string) => unknown;

let speechRecognitionPackage: SpeechRecognitionPackage | null = null;
let speechRecognitionLoadFailed = false;

export function loadSpeechRecognitionPackage(): SpeechRecognitionPackage | null {
  if (speechRecognitionPackage || speechRecognitionLoadFailed) {
    return speechRecognitionPackage;
  }
  try {
    speechRecognitionPackage = require("expo-speech-recognition") as SpeechRecognitionPackage;
  } catch {
    speechRecognitionLoadFailed = true;
  }
  return speechRecognitionPackage;
}

export function useSafeSpeechRecognitionEvent<K extends keyof ExpoSpeechRecognitionNativeEventMap>(
  eventName: K,
  listener: (event: ExpoSpeechRecognitionNativeEventMap[K]) => void
) {
  const eventHook = loadSpeechRecognitionPackage()?.useSpeechRecognitionEvent ?? noopSpeechEventHook;
  eventHook(eventName, listener);
}
