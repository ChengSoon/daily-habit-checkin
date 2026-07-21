import * as Speech from "expo-speech";
import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionNativeEventMap
} from "expo-speech-recognition";
import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  initialVoiceConversationState,
  isRecoverableVoiceError,
  textForSpeech,
  voiceConversationReducer,
  voiceErrorMessage
} from "./voiceConversationState";

const RESTART_DELAY_MS = 850;

type SpeechRecognitionPackage = {
  ExpoSpeechRecognitionModule: typeof import("expo-speech-recognition").ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent: SafeSpeechEventHook;
};
type SafeSpeechEventHook = <K extends keyof ExpoSpeechRecognitionNativeEventMap>(
  eventName: K,
  listener: (event: ExpoSpeechRecognitionNativeEventMap[K]) => void
) => void;
const noopSpeechEventHook: SafeSpeechEventHook = () => undefined;

declare const require: (moduleName: string) => unknown;

let speechRecognitionPackage: SpeechRecognitionPackage | null = null;
let speechRecognitionLoadFailed = false;

function loadSpeechRecognitionPackage(): SpeechRecognitionPackage | null {
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

function useSafeSpeechRecognitionEvent<K extends keyof ExpoSpeechRecognitionNativeEventMap>(
  eventName: K,
  listener: (event: ExpoSpeechRecognitionNativeEventMap[K]) => void
) {
  const eventHook = loadSpeechRecognitionPackage()?.useSpeechRecognitionEvent ?? noopSpeechEventHook;
  eventHook(eventName, listener);
}

type VoiceConversationOptions = {
  disabled: boolean;
  sendMessage: (text: string) => Promise<string | null>;
};

export function usePetVoiceConversation({ disabled, sendMessage }: VoiceConversationOptions) {
  const [state, dispatch] = useReducer(
    voiceConversationReducer,
    initialVoiceConversationState
  );
  const activeRef = useRef(false);
  const processingRef = useRef(false);
  const stateRef = useRef(state);
  const sendMessageRef = useRef(sendMessage);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const clearRestartTimer = useCallback(() => {
    if (!restartTimer.current) return;
    clearTimeout(restartTimer.current);
    restartTimer.current = null;
  }, []);

  const startNativeRecognition = useCallback(() => {
    if (!activeRef.current || processingRef.current) return;
    const module = loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule;
    if (!module) {
      dispatch({ type: "failed", message: "当前 App 没有包含原生语音模块，请安装 development build" });
      return;
    }
    clearRestartTimer();
    dispatch({ type: "listening" });
    try {
      module.start({
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
        volumeChangeEventOptions: { enabled: true, intervalMillis: 120 }
      });
    } catch {
      dispatch({ type: "failed", message: "原生语音模块尚未装入当前开发构建" });
    }
  }, [clearRestartTimer]);

  const scheduleRestart = useCallback(() => {
    clearRestartTimer();
    restartTimer.current = setTimeout(startNativeRecognition, RESTART_DELAY_MS);
  }, [clearRestartTimer, startNativeRecognition]);

  const speakReply = useCallback(
    (reply: string) => {
      const spokenText = textForSpeech(reply);
      if (!spokenText) {
        processingRef.current = false;
        startNativeRecognition();
        return;
      }
      dispatch({ type: "speaking" });
      const resumeListening = () => {
        if (!activeRef.current) return;
        processingRef.current = false;
        startNativeRecognition();
      };
      Speech.speak(spokenText, {
        language: "zh-CN",
        pitch: 1.04,
        rate: 0.96,
        onDone: resumeListening,
        onStopped: resumeListening,
        onError: resumeListening
      });
    },
    [startNativeRecognition]
  );

  const submitTranscript = useCallback(
    async (transcript: string) => {
      processingRef.current = true;
      dispatch({ type: "thinking", transcript });
      const reply = await sendMessageRef.current(transcript);
      if (!activeRef.current) return;
      if (reply) {
        speakReply(reply);
        return;
      }
      processingRef.current = false;
      dispatch({ type: "failed", message: "卡卡暂时没接上话，我再听一次" });
      scheduleRestart();
    },
    [scheduleRestart, speakReply]
  );

  useSafeSpeechRecognitionEvent("start", () => {
    if (activeRef.current && !processingRef.current) dispatch({ type: "listening" });
  });

  useSafeSpeechRecognitionEvent("result", (event) => {
    if (!activeRef.current || processingRef.current) return;
    const transcript = event.results[0]?.transcript.trim() ?? "";
    dispatch({ type: "transcript_changed", transcript });
    if (!event.isFinal) return;
    if (!transcript) {
      dispatch({ type: "failed", message: "我没听清，再说一次吧" });
      scheduleRestart();
      return;
    }
    processingRef.current = true;
    loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule.abort();
    void submitTranscript(transcript);
  });

  useSafeSpeechRecognitionEvent("volumechange", (event) => {
    if (activeRef.current) dispatch({ type: "volume_changed", volume: event.value });
  });

  useSafeSpeechRecognitionEvent("end", () => {
    if (
      activeRef.current &&
      !processingRef.current &&
      stateRef.current.phase === "listening"
    ) {
      scheduleRestart();
    }
  });

  useSafeSpeechRecognitionEvent("error", (event: ExpoSpeechRecognitionErrorEvent) => {
    if (!activeRef.current || event.error === "aborted") return;
    processingRef.current = false;
    dispatch({ type: "failed", message: voiceErrorMessage(event.error) });
    if (isRecoverableVoiceError(event.error)) scheduleRestart();
  });

  const start = useCallback(async () => {
    if (disabled || activeRef.current) return;
    activeRef.current = true;
    processingRef.current = false;
    dispatch({ type: "started" });
    await Speech.stop();
    try {
      const module = loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule;
      if (!module) {
        dispatch({ type: "failed", message: "当前 App 没有包含原生语音模块，请安装 development build" });
        return;
      }
      if (!module.isRecognitionAvailable()) {
        dispatch({ type: "failed", message: "模拟器里没有可用的语音识别服务" });
        return;
      }
      const permission = await module.requestPermissionsAsync();
      if (!activeRef.current) return;
      if (!permission.granted) {
        dispatch({ type: "failed", message: "需要麦克风和语音识别权限才能继续" });
        return;
      }
      startNativeRecognition();
    } catch {
      dispatch({ type: "failed", message: "请重新构建 Expo development build 后再试" });
    }
  }, [disabled, startNativeRecognition]);

  const stop = useCallback(() => {
    activeRef.current = false;
    processingRef.current = false;
    clearRestartTimer();
    try {
      loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule.abort();
    } catch {
      // 当前开发构建没有原生模块时，仍需正常退出语音界面。
    }
    void Speech.stop();
    dispatch({ type: "stopped" });
  }, [clearRestartTimer]);

  const interrupt = useCallback(() => {
    if (!activeRef.current) return;
    if (stateRef.current.phase === "speaking") {
      void Speech.stop();
      return;
    }
    if (stateRef.current.phase === "error") startNativeRecognition();
  }, [startNativeRecognition]);

  useEffect(
    () => () => {
      activeRef.current = false;
      clearRestartTimer();
      try {
        loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule.abort();
      } catch {
        // 卸载时忽略缺失的原生模块。
      }
      void Speech.stop();
    },
    [clearRestartTimer]
  );

  return { ...state, start, stop, interrupt };
}
