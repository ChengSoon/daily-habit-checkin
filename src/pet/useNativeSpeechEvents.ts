import type { ExpoSpeechRecognitionErrorEvent } from "expo-speech-recognition";
import {
  isRecoverableVoiceError,
  voiceErrorMessage
} from "./voiceConversationState";
import {
  loadSpeechRecognitionPackage,
  useSafeSpeechRecognitionEvent
} from "./speechRecognition";

type NativeSpeechEventOptions = {
  enabled: boolean;
  isActive: () => boolean;
  isProcessing: () => boolean;
  isListeningPhase: () => boolean;
  onListening: () => void;
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onVolume: (volume: number) => void;
  onEndWhileListening: () => void;
  onError: (message: string, recoverable: boolean) => void;
};

export function useNativeSpeechEvents(options: NativeSpeechEventOptions) {
  useSafeSpeechRecognitionEvent("start", () => {
    if (options.enabled && options.isActive() && !options.isProcessing()) options.onListening();
  });
  useSafeSpeechRecognitionEvent("result", (event) => {
    if (!options.enabled || !options.isActive() || options.isProcessing()) return;
    const transcript = event.results[0]?.transcript.trim() ?? "";
    options.onTranscript(transcript, event.isFinal);
    if (!event.isFinal) return;
    if (transcript) {
      loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule.abort();
    }
  });
  useSafeSpeechRecognitionEvent("volumechange", (event) => {
    if (options.enabled && options.isActive()) options.onVolume(event.value);
  });
  useSafeSpeechRecognitionEvent("end", () => {
    if (
      options.enabled &&
      options.isActive() &&
      !options.isProcessing() &&
      options.isListeningPhase()
    ) {
      options.onEndWhileListening();
    }
  });
  useSafeSpeechRecognitionEvent("error", (event: ExpoSpeechRecognitionErrorEvent) => {
    if (!options.enabled || !options.isActive() || event.error === "aborted") return;
    options.onError(voiceErrorMessage(event.error), isRecoverableVoiceError(event.error));
  });
}
