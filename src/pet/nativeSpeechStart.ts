import { androidSpeechStartOptions } from "./speechRecognitionAndroid";

export function buildNativeSpeechStartOptions(androidServicePackage?: string) {
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
    iosTaskHint: "dictation" as const,
    iosCategory: {
      category: "playAndRecord" as const,
      categoryOptions: ["defaultToSpeaker", "allowBluetooth"] as const,
      mode: "voiceChat" as const
    },
    iosVoiceProcessingEnabled: true,
    volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
    ...androidSpeechStartOptions(androidServicePackage)
  };
}
