import * as Speech from "expo-speech";
import type { ExpoSpeechRecognitionErrorEvent } from "expo-speech-recognition";
import { AppState } from "react-native";
import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  commandAfterWakePhrase,
  initialVoiceWakeState,
  isRecoverableVoiceWakeError,
  voiceWakeErrorMessage,
  voiceWakeReducer
} from "./voiceWakeState";
import {
  loadSpeechRecognitionPackage,
  useSafeSpeechRecognitionEvent
} from "./speechRecognition";

const RESTART_DELAY_MS = 850;

type VoiceWakeOptions = {
  enabled: boolean;
  onWake: (command: string) => void;
};

export function usePetVoiceWake({ enabled, onWake }: VoiceWakeOptions) {
  const [state, dispatch] = useReducer(voiceWakeReducer, initialVoiceWakeState);
  const enabledRef = useRef(enabled);
  const activeRef = useRef(false);
  const recognitionRef = useRef(false);
  const onWakeRef = useRef(onWake);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    enabledRef.current = enabled;
    onWakeRef.current = onWake;
  }, [enabled, onWake]);

  const clearRestartTimer = useCallback(() => {
    if (!restartTimer.current) return;
    clearTimeout(restartTimer.current);
    restartTimer.current = null;
  }, []);

  const startNativeRecognition = useCallback(() => {
    if (!activeRef.current || recognitionRef.current) return;
    const module = loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule;
    if (!module) {
      activeRef.current = false;
      dispatch({
        type: "failed",
        active: false,
        message: "当前 App 没有包含语音唤醒模块，请安装 development build"
      });
      return;
    }

    clearRestartTimer();
    recognitionRef.current = true;
    dispatch({ type: "listening" });
    try {
      module.start({
        lang: "zh-CN",
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        addsPunctuation: true,
        contextualStrings: ["卡卡", "咔咔", "喀喀", "唤醒卡卡"],
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1000,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 650
        },
        iosTaskHint: "dictation",
        iosCategory: {
          category: "playAndRecord",
          categoryOptions: ["defaultToSpeaker", "allowBluetooth"],
          mode: "voiceChat"
        },
        iosVoiceProcessingEnabled: true,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 160 }
      });
    } catch {
      recognitionRef.current = false;
      activeRef.current = false;
      dispatch({
        type: "failed",
        active: false,
        message: "语音唤醒模块尚未装入当前开发构建"
      });
    }
  }, [clearRestartTimer]);

  const scheduleRestart = useCallback(() => {
    clearRestartTimer();
    if (!activeRef.current) return;
    restartTimer.current = setTimeout(startNativeRecognition, RESTART_DELAY_MS);
  }, [clearRestartTimer, startNativeRecognition]);

  const start = useCallback(async () => {
    if (!enabledRef.current || activeRef.current) return;
    activeRef.current = true;
    recognitionRef.current = false;
    dispatch({ type: "started" });
    await Speech.stop();

    try {
      const module = loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule;
      if (!module) throw new Error("missing-module");
      if (!module.isRecognitionAvailable()) throw new Error("unavailable");
      const permission = await module.requestPermissionsAsync();
      if (!activeRef.current) return;
      if (!permission.granted) {
        activeRef.current = false;
        dispatch({
          type: "failed",
          active: false,
          message: "需要麦克风和语音识别权限才能唤醒卡卡"
        });
        return;
      }
      startNativeRecognition();
    } catch {
      activeRef.current = false;
      dispatch({
        type: "failed",
        active: false,
        message: "请重新构建 Expo development build 后再开启语音唤醒"
      });
    }
  }, [startNativeRecognition]);

  const stop = useCallback(() => {
    activeRef.current = false;
    recognitionRef.current = false;
    clearRestartTimer();
    try {
      loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule.abort();
    } catch {
      // 当前开发构建没有原生模块时，忽略退出监听的异常。
    }
    void Speech.stop();
    dispatch({ type: "stopped" });
  }, [clearRestartTimer]);

  useSafeSpeechRecognitionEvent("start", () => {
    if (activeRef.current) dispatch({ type: "listening" });
  });

  useSafeSpeechRecognitionEvent("result", (event) => {
    if (!activeRef.current || !recognitionRef.current || !event.isFinal) return;
    recognitionRef.current = false;
    const transcript = event.results[0]?.transcript ?? "";
    const command = commandAfterWakePhrase(transcript);
    if (command === null) {
      scheduleRestart();
      return;
    }

    activeRef.current = false;
    clearRestartTimer();
    try {
      loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule.abort();
    } catch {
      // 唤醒交接时忽略原生中止异常。
    }
    dispatch({ type: "stopped" });
    onWakeRef.current(command);
  });

  useSafeSpeechRecognitionEvent("volumechange", (event) => {
    if (activeRef.current) dispatch({ type: "volume_changed", volume: event.value });
  });

  useSafeSpeechRecognitionEvent("end", () => {
    recognitionRef.current = false;
    if (activeRef.current) scheduleRestart();
  });

  useSafeSpeechRecognitionEvent("error", (event: ExpoSpeechRecognitionErrorEvent) => {
    recognitionRef.current = false;
    if (!activeRef.current || event.error === "aborted") return;
    const recoverable = isRecoverableVoiceWakeError(event.error);
    if (!recoverable) activeRef.current = false;
    dispatch({
      type: "failed",
      active: activeRef.current,
      message: voiceWakeErrorMessage(event.error)
    });
    if (recoverable) scheduleRestart();
  });

  useEffect(() => {
    if (enabled && AppState.currentState === "active") void start();
    if (!enabled) stop();
    return () => {
      if (!enabled) stop();
    };
  }, [enabled, start, stop]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && enabledRef.current) {
        void start();
      } else if (nextState !== "active") {
        stop();
      }
    });
    return () => subscription.remove();
  }, [start, stop]);

  useEffect(
    () => () => {
      activeRef.current = false;
      recognitionRef.current = false;
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

  return { ...state, start, stop };
}
