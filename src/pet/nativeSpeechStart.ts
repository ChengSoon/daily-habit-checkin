import type { ExpoSpeechRecognitionOptions } from "expo-speech-recognition";
import { androidSpeechStartOptions } from "./speechRecognitionAndroid";

export function buildNativeSpeechStartOptions(
  androidServicePackage?: string
): ExpoSpeechRecognitionOptions {
  return {
    lang: "zh-CN",
    interimResults: true,
    continuous: false,
    maxAlternatives: 1,
    addsPunctuation: true,
    contextualStrings: ["卡卡", "打卡", "习惯", "连续天数"],
    androidIntentOptions: {
      EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1200,
      EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 700
    },
    iosTaskHint: "dictation",
    iosCategory: {
      category: "playAndRecord",
      categoryOptions: ["defaultToSpeaker", "allowBluetooth"],
      mode: "voiceChat"
    },
    iosVoiceProcessingEnabled: true,
    volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
    ...androidSpeechStartOptions(androidServicePackage)
  };
}
